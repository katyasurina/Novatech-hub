import { Router } from 'express';
import { z } from 'zod';
import {
  productUpsertSchema,
  productUpdateSchema,
  setReviewStatusSchema,
  type ProductUpdateInput,
  type ProductUpsertInput,
  type SetReviewStatusInput,
} from '@novatech/shared';
import { asyncHandler } from '../../lib/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { routeParam, validateBody, validateParams, validateQuery } from '../../middleware/validate';
import * as admin from './admin.service';

const idSchema = z.object({ id: z.string().min(1) });
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
const moderationQuerySchema = paginationSchema.extend({
  status: z.enum(['VISIBLE', 'SUSPENDED']).optional(),
});

/** Every route below requires an authenticated ADMIN. */
export const adminRouter: Router = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

/** GET /api/v1/admin/stats — dashboard aggregates. */
adminRouter.get(
  '/admin/stats',
  asyncHandler(async (_req, res) => {
    res.json(await admin.getAdminStats());
  }),
);

/** GET /api/v1/admin/products?page&pageSize */
adminRouter.get(
  '/admin/products',
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { items, total } = await admin.listAdminProducts(page, pageSize);
    res.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  }),
);

/** POST /api/v1/admin/products */
adminRouter.post(
  '/admin/products',
  validateBody(productUpsertSchema),
  asyncHandler(async (req, res) => {
    const product = await admin.createProduct(req.body as ProductUpsertInput);
    res.status(201).json(product);
  }),
);

/** PUT /api/v1/admin/products/:id */
adminRouter.put(
  '/admin/products/:id',
  validateParams(idSchema),
  validateBody(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const product = await admin.updateProduct(routeParam(req, 'id'), req.body as ProductUpdateInput);
    res.json(product);
  }),
);

/** DELETE /api/v1/admin/products/:id — cascades reviews, votes, wishlist rows. */
adminRouter.delete(
  '/admin/products/:id',
  validateParams(idSchema),
  asyncHandler(async (req, res) => {
    await admin.deleteProduct(routeParam(req, 'id'));
    res.status(204).send();
  }),
);

/** GET /api/v1/admin/reviews?status&page&pageSize — moderation queue. */
adminRouter.get(
  '/admin/reviews',
  validateQuery(moderationQuerySchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number; status?: 'VISIBLE' | 'SUSPENDED' };
    const { items, total } = await admin.listModerationQueue(q);
    res.json({ items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) });
  }),
);

/** PUT /api/v1/admin/reviews/:id/status — suspend or restore a review. */
adminRouter.put(
  '/admin/reviews/:id/status',
  validateParams(idSchema),
  validateBody(setReviewStatusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as SetReviewStatusInput;
    await admin.setReviewStatus(routeParam(req, 'id'), status);
    res.json({ ok: true, status });
  }),
);

/** DELETE /api/v1/admin/reviews/:id — hard delete. */
adminRouter.delete(
  '/admin/reviews/:id',
  validateParams(idSchema),
  asyncHandler(async (req, res) => {
    await admin.deleteReview(routeParam(req, 'id'));
    res.status(204).send();
  }),
);