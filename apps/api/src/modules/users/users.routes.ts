import { Router } from 'express';
import { z } from 'zod';
import {
  profileUpdateSchema,
  reviewsQuerySchema,
  type ProfileUpdateInput,
  type ReviewsQuery,
} from '@novatech/shared';
import { AppError, asyncHandler } from '../../lib/errors';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { routeParam, validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { writeLimiter } from '../../middleware/rateLimit';
import { avatarUpload } from '../../lib/upload';
import * as users from './users.service';

export const usersRouter: Router = Router();

const usernameSchema = z.object({ username: z.string().min(1).max(30) });
const productIdSchema = z.object({ productId: z.string().min(1) });

/**
 * GET /api/v1/users/:username
 * Public profile + aggregate stats (reviews written, average rating given).
 */
usersRouter.get(
  '/users/:username',
  optionalAuth,
  validateParams(usernameSchema),
  asyncHandler(async (req, res) => {
    const profile = await users.getProfileByUsername(routeParam(req, 'username'), req.auth?.id ?? null);
    res.json(profile);
  }),
);

/**
 * GET /api/v1/users/:username/reviews?page&pageSize&sort
 * Reviews written by that user, each with its product, paginated.
 */
usersRouter.get(
  '/users/:username/reviews',
  optionalAuth,
  validateParams(usernameSchema),
  validateQuery(reviewsQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await users.listUserReviews(
      routeParam(req, 'username'),
      req.query as unknown as ReviewsQuery,
      { userId: req.auth?.id ?? null, isAdmin: req.auth?.role === 'ADMIN' },
    );
    res.json(result);
  }),
);

/**
 * GET /api/v1/users/me
 * Own full profile (includes email) + stats, for the profile editor.
 */
usersRouter.get(
  '/users/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await users.getOwnProfile(req.auth!.id);
    res.json(profile);
  }),
);

/**
 * PATCH /api/v1/users/me
 * Update name / bio. Body follows ProfileUpdateInput.
 */
usersRouter.patch(
  '/users/me',
  requireAuth,
  writeLimiter,
  validateBody(profileUpdateSchema),
  asyncHandler(async (req, res) => {
    const user = await users.updateProfile(req.auth!.id, req.body as ProfileUpdateInput);
    res.json(user);
  }),
);

/**
 * POST /api/v1/users/me/avatar  (multipart/form-data, field name "avatar")
 * Upload a new avatar image; returns the updated user record.
 */
usersRouter.post(
  '/users/me/avatar',
  requireAuth,
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('Choose an image to upload.');
    const user = await users.setAvatar(req.auth!.id, `/media/avatars/${req.file.filename}`);
    res.json(user);
  }),
);

// ---------------------------------------------------------------------------
// Wishlist (scoped to the signed-in user)
// ---------------------------------------------------------------------------

/** GET /api/v1/users/me/wishlist */
usersRouter.get(
  '/users/me/wishlist',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await users.getWishlist(req.auth!.id);
    res.json(items);
  }),
);

/** PUT /api/v1/users/me/wishlist/:productId — add (idempotent). */
usersRouter.put(
  '/users/me/wishlist/:productId',
  requireAuth,
  writeLimiter,
  validateParams(productIdSchema),
  asyncHandler(async (req, res) => {
    await users.addWishlistItem(req.auth!.id, routeParam(req, 'productId'));
    res.status(200).json({ added: true });
  }),
);

/** DELETE /api/v1/users/me/wishlist/:productId — remove (idempotent). */
usersRouter.delete(
  '/users/me/wishlist/:productId',
  requireAuth,
  writeLimiter,
  validateParams(productIdSchema),
  asyncHandler(async (req, res) => {
    await users.removeWishlistItem(req.auth!.id, routeParam(req, 'productId'));
    res.status(204).send();
  }),
);