import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/errors';
import { validateQuery } from '../../middleware/validate';
import * as trending from './trending.service';

const limitSchema = z.object({ limit: z.coerce.number().int().min(1).max(24).optional() });

export const trendingRouter: Router = Router();

/**
 * GET /api/v1/trending?limit
 * Products ranked by the live trending score, with a readable breakdown so the
 * frontend can show "why this is trending" (formula included per row).
 */
trendingRouter.get(
  '/trending',
  validateQuery(limitSchema),
  asyncHandler(async (req, res) => {
    const limit = (req.query as { limit?: number }).limit;
    res.json(await trending.listTrending(limit));
  }),
);

/**
 * GET /api/v1/home
 * One round-trip for the homepage: featured products, top categories (with a
 * best-seller each) and the trending shortlist. All computed from the DB.
 */
trendingRouter.get(
  '/home',
  asyncHandler(async (_req, res) => {
    res.json(await trending.getHomeAggregates());
  }),
);