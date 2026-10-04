import { z } from 'zod';
import { CATEGORIES } from '../constants';

/** Basic aggregate over reviews written by / product has — used by the admin dashboard. */

export const adminStatsSchema = z.object({
  totals: z.object({
    users: z.number().int(),
    products: z.number().int(),
    reviews: z.number().int(),
    suspendedReviews: z.number().int(),
    wishlistItems: z.number().int(),
  }),
  /** reviews created-per-day for the last N days (the "ratings over time" line). */
  reviewsOverTime: z.array(
    z.object({ date: z.string(), count: z.number().int(), averageRating: z.number().nullable() }),
  ),
  /** products per category (the distribution pie). */
  categoryDistribution: z.array(
    z.object({ category: z.enum(CATEGORIES), count: z.number().int() }),
  ),
  /** top rated products across the whole catalogue. */
  topRated: z.array(z.object({ slug: z.string(), name: z.string(), averageRating: z.number().nullable(), reviewCount: z.number().int() })),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

/** Admin moderation queue item (a review with its product + author). */
export const moderationItemSchema = z.object({
  id: z.string(),
  rating: z.number().int(),
  title: z.string(),
  body: z.string(),
  status: z.enum(['VISIBLE', 'SUSPENDED']),
  createdAt: z.date(),
  product: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  author: z.object({ id: z.string(), username: z.string(), avatarUrl: z.string().nullable() }),
});
export type ModerationItem = z.infer<typeof moderationItemSchema>;

export const setReviewStatusSchema = z.object({
  status: z.enum(['VISIBLE', 'SUSPENDED']),
});
export type SetReviewStatusInput = z.infer<typeof setReviewStatusSchema>;