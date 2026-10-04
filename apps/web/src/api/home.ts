import { z } from 'zod';
import { parseWithDates } from '../lib/dates';
import { apiFetch } from './client';
import {
  type HomeAggregates,
  type TrendingProduct,
  homeAggregatesSchema,
  trendingProductSchema,
} from '@novatech/shared';

/** GET /home — one round-trip: featured, per-category best sellers, trending. */
export async function fetchHomeAggregates(): Promise<HomeAggregates> {
  const data = await apiFetch('/home');
  return parseWithDates(homeAggregatesSchema, data);
}

/** GET /trending?limit — ranked with the human-readable score breakdown. */
export async function fetchTrending(limit = 8): Promise<TrendingProduct[]> {
  const data = await apiFetch(`/trending?limit=${limit}`);
  return parseWithDates(z.array(trendingProductSchema), data);
}