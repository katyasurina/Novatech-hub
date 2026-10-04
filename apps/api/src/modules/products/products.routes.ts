import { Router } from 'express';
import { z } from 'zod';
import {
  catalogQuerySchema,
  reviewsQuerySchema,
  type CatalogQuery,
  type ReviewsQuery,
} from '@novatech/shared';
import { asyncHandler } from '../../lib/errors';
import { optionalAuth } from '../../middleware/auth';
import { routeParam, validateParams, validateQuery } from '../../middleware/validate';
import * as products from './products.service';

const slugSchema = z.object({ slug: z.string().min(1).max(120) });
const productIdSchema = z.object({ productId: z.string().min(1) });

export const productsRouter: Router = Router();

/**
 * GET /api/v1/products?page&pageSize&q&category&sort&minPrice&maxPrice&minRating
 * Catalog list. Reviews are aggregated live (avg/ count/ trending) — the URL
 * fully encodes the filter set so results are shareable.
 */
productsRouter.get(
  '/products',
  optionalAuth,
  validateQuery(catalogQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await products.listCatalog(req.query as unknown as CatalogQuery);
    res.json(result);
  }),
);

/**
 * GET /api/v1/products/:slug
 * Product detail + live review summary (average, count, 1..10 histogram).
 */
productsRouter.get(
  '/products/:slug',
  optionalAuth,
  validateParams(slugSchema),
  asyncHandler(async (req, res) => {
    const result = await products.getProductDetail(routeParam(req, 'slug'));
    res.json(result);
  }),
);

/**
 * GET /api/v1/products/:productId/reviews?page&pageSize&sort
 * Paginated reviews with per-requester vote state.
 */
productsRouter.get(
  '/products/:productId/reviews',
  optionalAuth,
  validateParams(productIdSchema),
  validateQuery(reviewsQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await products.listReviews(
      routeParam(req, 'productId'),
      req.query as unknown as ReviewsQuery,
      {
        userId: req.auth?.id ?? null,
        isAdmin: req.auth?.role === 'ADMIN',
      },
    );
    res.json(result);
  }),
);