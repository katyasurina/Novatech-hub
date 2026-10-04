import { Prisma } from '@prisma/client';

/**
 * The trending formula — single source of truth, shared by the SQL queries and
 * the JS mirror used in tests. Score ∈ [0, 10].
 *
 *   ratingComponent  = 0.55 · (μ − 1) / 9                      ← quality, 1..10 → 0..1
 *   volumeComponent  = 0.30 · min(1, ln(1 + n) / ln(32))       ← saturating volume (cap at weight)
 *   recencyComponent = 0.15 · e^(−days·sinceLastReview / 21)   ← half-life ≈ 2 weeks
 *   score            = 10 · (rating + volume + recency)        ← 0 when the product has no reviews
 *
 * The volume term is clamped so it can never exceed its weight: without the
 * clamp, ln(1+60)/ln(32) ≈ 1.19 lets a flood of reviews push a 10/10 product
 * past 10.0. A product with no reviews has no signal at all — score 0, never
 * negative (the SQL path additionally falls back to createdAt for recency).
 *
 * Rationale: an old 10/10 with one review ⇢ 0.55 + 0.06 + 0 ≈ 0.61 loses to a
 * product rated 8.5 with 13 recent reviews ⇢ 0.46 + 0.22 + 0.15 ≈ 0.83. The
 * rating weight stops spammy perfect scores from dominating; the saturating log
 * and exponential decay prevent "many reviews, long ago" from clinging on
 * forever. Every term is derived from DB rows at query time — nothing cached.
 */

export const TRENDING_WEIGHTS = {
  rating: 0.55,
  volume: 0.3,
  recency: 0.15,
} as const;

/** Half-life of the recency term, in days. */
export const RECENCY_HALF_LIFE_DAYS = 21;

/** Volume term saturates around 31 reviews: min(1, ln(1+31)/ln(32)) = 1. */
export const VOLUME_SATURATION = 31;

export function computeTrendingScore(
  averageRating: number | null,
  reviewCount: number,
  mostRecentReviewAt: Date | null,
  now: Date = new Date(),
): number {
  // No reviews = no signal. Returns 0 rather than letting the 0-rating drag the
  // rating term negative. (When only a recency date is given — a synthetic probe
  // in tests — the normal terms still apply.)
  if (reviewCount <= 0 && mostRecentReviewAt === null) return 0;

  const rating = averageRating ?? 0;
  const ratingComponent = TRENDING_WEIGHTS.rating * ((rating - 1) / 9);
  // Clamp at 1.0 so volume can never exceed its 0.30 weight (score stays ≤ 10).
  const volumeComponent =
    TRENDING_WEIGHTS.volume *
    Math.min(1, Math.log(1 + Math.max(0, reviewCount)) / Math.log(1 + VOLUME_SATURATION));
  const daysSince = mostRecentReviewAt
    ? Math.max(0, (now.getTime() - mostRecentReviewAt.getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY;
  const recencyComponent =
    TRENDING_WEIGHTS.recency * Math.exp(-daysSince / RECENCY_HALF_LIFE_DAYS);
  // Weights sum to exactly 1.0, so the upper bound is 10 by construction; clamp
  // defensively so float rounding can never produce a 10.000…2.
  return Math.min(10, 10 * (ratingComponent + volumeComponent + recencyComponent));
}

/**
 * SQL literal string (not a Prisma.sql template) so it can be safely inlined
 * into another Prisma.sql template via Prisma.raw() without parameter conflicts.
 */
function sqlNum(n: number): string {
  return String(n);
}

/**
 * SQL covering expression as a plain string — references a left-joined
 * aggregates subquery aliased `agg` (columns: "averageRating", "reviewCount",
 * "lastReviewedAt") and the product row aliased `p` ("createdAt").
 * Callers wrap with Prisma.raw() when interpolating into a Prisma.sql template.
 */
export function sqlTrendingTotal(aggAlias = 'agg', pAlias = 'p'): string {
  return `(
    CASE WHEN COALESCE(${aggAlias}."reviewCount", 0) = 0 THEN 0
    ELSE 10 * (
      ${sqlNum(TRENDING_WEIGHTS.rating)} * ((COALESCE(${aggAlias}."averageRating", 0) - 1) / 9.0)
      + ${sqlNum(TRENDING_WEIGHTS.volume)} * LEAST(1.0, (ln(1 + COALESCE(${aggAlias}."reviewCount", 0)) / ln(${1 + VOLUME_SATURATION})))
      + ${sqlNum(TRENDING_WEIGHTS.recency)} * exp(-EXTRACT(EPOCH FROM (now() - COALESCE(${aggAlias}."lastReviewedAt", ${pAlias}."createdAt"))) / 86400.0 / ${RECENCY_HALF_LIFE_DAYS})
    )
    END
  )`;
}

export function sqlTrendingComponents(): string {
  return `(
      ${sqlNum(TRENDING_WEIGHTS.rating)} * ((COALESCE(agg."averageRating", 0) - 1) / 9.0)
    ) "ratingComponent",
    (
      ${sqlNum(TRENDING_WEIGHTS.volume)} * LEAST(1.0, (ln(1 + COALESCE(agg."reviewCount", 0)) / ln(${1 + VOLUME_SATURATION})))
    ) "volumeComponent",
    (
      ${sqlNum(TRENDING_WEIGHTS.recency)} * exp(-EXTRACT(EPOCH FROM (now() - COALESCE(agg."lastReviewedAt", p."createdAt"))) / 86400.0 / ${RECENCY_HALF_LIFE_DAYS})
    ) "recencyComponent"`;
}

export const SCORE_FORMULA =
  '10 · ( 0.55·(Rating−1)/9 + 0.30·min(1, ln(1+Reviews)/ln(32)) + 0.15·e^(−Days/21) ) — 0 when a product has no reviews';

/** Shared aggregates subquery as a plain string — reviews must be VISIBLE. */
export function sqlAggregates(alias = 'agg'): string {
  return `LEFT JOIN (
      SELECT
        r."productId" AS pid,
        ROUND(AVG(r.rating)::numeric, 2)::float8 AS "averageRating",
        COUNT(*)::int AS "reviewCount",
        MAX(r."createdAt") AS "lastReviewedAt"
      FROM "Review" r
      WHERE r.visibility = 'VISIBLE'
      GROUP BY r."productId"
    ) ${alias} ON ${alias}.pid = p.id`;
}