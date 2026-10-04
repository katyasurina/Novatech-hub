import { Router } from 'express';
import { z } from 'zod';
import {
  createReviewSchema,
  updateReviewSchema,
  voteSchema,
  type CreateReviewInput,
  type UpdateReviewInput,
  type VoteInput,
} from '@novatech/shared';
import { asyncHandler } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { routeParam, validateBody, validateParams } from '../../middleware/validate';
import { writeLimiter } from '../../middleware/rateLimit';
import * as reviews from './reviews.service';

const productIdSchema = z.object({
  productId: z.string().min(1),
});
const reviewAndProductIdSchema = z.object({
  productId: z.string().min(1),
  reviewId: z.string().min(1),
});
const reviewIdSchema = z.object({
  reviewId: z.string().min(1),
});

export const reviewsRouter: Router = Router();

/**
 * POST /api/v1/products/:productId/reviews
 * Create a review (one per user per product). Emits review:created over socket.io.
 */
reviewsRouter.post(
  '/products/:productId/reviews',
  requireAuth,
  writeLimiter,
  validateParams(productIdSchema),
  validateBody(createReviewSchema),
  asyncHandler(async (req, res) => {
    const dto = await reviews.createReview(
      routeParam(req, 'productId'),
      req.auth!.id,
      req.body as CreateReviewInput,
    );
    res.status(201).json(dto);
  }),
);

/**
 * PATCH /api/v1/products/:productId/reviews/:reviewId
 * Update your own review (owner only).
 */
reviewsRouter.patch(
  '/products/:productId/reviews/:reviewId',
  requireAuth,
  writeLimiter,
  validateParams(reviewAndProductIdSchema),
  validateBody(updateReviewSchema),
  asyncHandler(async (req, res) => {
    const dto = await reviews.updateReview(
      routeParam(req, 'productId'),
      routeParam(req, 'reviewId'),
      req.auth!.id,
      req.body as UpdateReviewInput,
    );
    res.json(dto);
  }),
);

/**
 * DELETE /api/v1/products/:productId/reviews/:reviewId
 * Delete your own review (or any, as an admin). Cascades its votes.
 */
reviewsRouter.delete(
  '/products/:productId/reviews/:reviewId',
  requireAuth,
  validateParams(reviewAndProductIdSchema),
  asyncHandler(async (req, res) => {
    await reviews.deleteReview(
      routeParam(req, 'productId'),
      routeParam(req, 'reviewId'),
      req.auth!.id,
      req.auth!.role === 'ADMIN',
    );
    res.status(204).send();
  }),
);

/**
 * POST /api/v1/reviews/:reviewId/vote
 * Body: { value: 1 | -1 }. Idempotent toggle.
 */
reviewsRouter.post(
  '/reviews/:reviewId/vote',
  requireAuth,
  writeLimiter,
  validateParams(reviewIdSchema),
  validateBody(voteSchema),
  asyncHandler(async (req, res) => {
    const result = await reviews.vote(routeParam(req, 'reviewId'), req.auth!.id, req.body as VoteInput);
    res.json(result);
  }),
);