import { Prisma } from '@prisma/client';
import {
  type HomeAggregates,
  type TrendingProduct,
  CATEGORIES,
  type Category,
} from '@novatech/shared';
import { prisma } from '../../db/prisma';
import { sqlAggregates, sqlTrendingComponents, sqlTrendingTotal, SCORE_FORMULA } from './score';

interface TrendingRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: Category;
  brand: string;
  priceMinor: number;
  currency: string;
  imageUrl: string;
  featured: boolean;
  averageRating: number | null;
  reviewCount: number;
  lastReviewedAt: Date | null;
  ratingComponent: number;
  volumeComponent: number;
  recencyComponent: number;
  score: number;
}

const AGREED_LIMIT = { max: 24 };

/** Latest SQL-first trending ranking with a visible score breakdown. */
export async function listTrending(limit = 8): Promise<TrendingProduct[]> {
  const n = Math.min(Math.max(1, limit), AGREED_LIMIT.max);
  const rows = await prisma.$queryRaw<TrendingRow[]>(Prisma.sql`
    SELECT
      p.id, p.slug, p.name, p.tagline, p.category,
      p.brand, p."priceMinor" AS "priceMinor", p.currency, p."imageUrl" AS "imageUrl",
      p.featured,
      COALESCE(agg."averageRating", 0) AS "averageRating",
      COALESCE(agg."reviewCount", 0)::int AS "reviewCount",
      agg."lastReviewedAt" AS "lastReviewedAt",
      ${Prisma.raw(sqlTrendingComponents())},
      ${Prisma.raw(sqlTrendingTotal('agg', 'p'))} AS score
    FROM "Product" p
    ${Prisma.raw(sqlAggregates('agg'))}
    ORDER BY score DESC, p."createdAt" DESC
    LIMIT ${n}
  `);
  return rows.map(toTrending);
}

/** Homepage: featured, per-category best sellers + counts, and the top trenders. */
export async function getHomeAggregates(): Promise<HomeAggregates> {
  const rows = await prisma.$queryRaw<TrendingRow[]>(Prisma.sql`
    SELECT
      p.id, p.slug, p.name, p.tagline, p.category,
      p.brand, p."priceMinor" AS "priceMinor", p.currency, p."imageUrl" AS "imageUrl",
      p.featured,
      COALESCE(agg."averageRating", 0) AS "averageRating",
      COALESCE(agg."reviewCount", 0)::int AS "reviewCount",
      agg."lastReviewedAt" AS "lastReviewedAt",
      ${Prisma.raw(sqlTrendingComponents())},
      ${Prisma.raw(sqlTrendingTotal('agg', 'p'))} AS score
    FROM "Product" p
    ${Prisma.raw(sqlAggregates('agg'))}
    ORDER BY score DESC, p."createdAt" DESC
  `);

  const all = rows.map(toTrending);

  // featured lives on the raw row, not the public DTO — filter before mapping.
  const featured = rows
    .filter((r) => r.featured && r.reviewCount > 0)
    .slice(0, 4)
    .map(toTrending);

  // Group every product (including review-less) by category for counts,
  // and let the highest-scoring product stand in as the category's best seller.
  const byCategory = new Map<Category, TrendingRow[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }
  const categories = CATEGORIES.map((category) => {
    const list = byCategory.get(category) ?? [];
    return {
      category,
      count: list.length,
      bestSeller: list[0] ? toTrending(list[0]) : null,
    };
  }).filter((c) => c.count > 0);

  return { featured, categories, trending: all.slice(0, 6) };
}

function toTrending(row: TrendingRow | null): TrendingProduct {
  if (!row) {
    throw new Error('Unexpected null row in trending aggregation');
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    category: row.category,
    brand: row.brand,
    priceMinor: row.priceMinor,
    currency: row.currency,
    imageUrl: row.imageUrl,
    averageRating: row.averageRating,
    reviewCount: row.reviewCount,
    lastReviewedAt: row.lastReviewedAt,
    score: round2(row.score),
    scoreBreakdown: {
      ratingComponent: round2(row.ratingComponent),
      volumeComponent: round2(row.volumeComponent),
      recencyComponent: round2(row.recencyComponent),
      formula: SCORE_FORMULA,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}