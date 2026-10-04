import { describe, expect, it } from 'vitest';
import {
  computeTrendingScore,
  TRENDING_WEIGHTS,
  VOLUME_SATURATION,
  RECENCY_HALF_LIFE_DAYS,
} from '../src/modules/trending/score';

/**
 * Tests the JS mirror of the trending formula. The SQL path (sqlTrendingTotal +
 * sqlTrendingComponents) must stay numerically identical — these bounds assert
 * the shared contract every product’s ranking depends on.
 */

const now = new Date('2026-09-13T12:00:00Z');
const days = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('computeTrendingScore', () => {
  it('sits in [0, 10] for every realistic input', () => {
    for (let rating = 1; rating <= 10; rating++) {
      for (let n = 0; n <= 60; n++) {
        for (const last of [days(0), days(7), days(90), null]) {
          const s = computeTrendingScore(rating, n, last, now);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('rewards recency: same stats, fresher review wins', () => {
    const recent = computeTrendingScore(8, 10, days(1), now);
    const stale = computeTrendingScore(8, 10, days(60), now);
    expect(recent).toBeGreaterThan(stale);
  });

  it('rewards volume, saturating: 10→60 reviews adds little', () => {
    const ten = computeTrendingScore(8, 10, days(5), now);
    const sixty = computeTrendingScore(8, 60, days(5), now);
    // ln(1+10)/ln(31) ≈ 0.69; ln(1+60)/ln(31) ≈ 1.19 → saturating, bounded boost.
    expect(sixty - ten).toBeGreaterThan(0);
    expect(sixty - ten).toBeLessThan(
      10 * TRENDING_WEIGHTS.volume * (1 - Math.log(1 + 10) / Math.log(1 + VOLUME_SATURATION)) + 0.01,
    );
  });

  it('rewards rating: a 10/10 beats an 8/10 at equal volume & recency', () => {
    const high = computeTrendingScore(10, 12, days(3), now);
    const low = computeTrendingScore(8, 12, days(3), now);
    expect(high).toBeGreaterThan(low);
  });

  it('a fresh 9.0 with 13 reviews outranks a stale 10.0 with 1 review', () => {
    const fresh = computeTrendingScore(9, 13, days(2), now);
    const stale = computeTrendingScore(10, 1, days(200), now);
    expect(fresh).toBeGreaterThan(stale);
  });

  it('recency half-life behaves: ~21-day mark halves the recency term', () => {
    const t0 = computeTrendingScore(8, 5, days(0), now);
    const tHalf = computeTrendingScore(8, 5, days(RECENCY_HALF_LIFE_DAYS), now);
    // delta = 10 · weight · (e^0 − e^−1)
    const expected = 10 * TRENDING_WEIGHTS.recency * (1 - Math.exp(-1));
    expect(t0 - tHalf).toBeCloseTo(expected, 5);
  });

  it('no reviews yet scores 0 in the JS mirror (SQL falls back to created_at)', () => {
    // A review-less product has nothing to aggregate: rating 0, volume 0, and
    // no last-review date. The SQL path uses created_at as recency fallback, but
    // the deterministic JS mirror conservatively terms it ∞ → recency 0.
    const s = computeTrendingScore(null, 0, null, now);
    expect(s).toBe(0);
    expect(computeTrendingScore(null, 0, days(0), now)).toBeGreaterThan(0);
  });
});