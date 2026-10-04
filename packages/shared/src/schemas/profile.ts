import { z } from 'zod';
import { CATEGORIES } from '../constants';
import { catalogProductSchema } from './catalog';
import { reviewSchema } from './review';

/** Add / remove a product on the signed-in user's wishlist. */
export const wishlistMutationSchema = z.object({
  productId: z.string().min(1),
});
export type WishlistMutationInput = z.infer<typeof wishlistMutationSchema>;

/** Row shown in the wishlist page (product + when it was added). */
export const wishlistItemSchema = z.object({
  addedAt: z.date(),
  product: catalogProductSchema,
});
export type WishlistItem = z.infer<typeof wishlistItemSchema>;

/** The set of product ids on the user's wishlist — cached for instant button state. */
export const wishlistIdsSchema = z.array(z.string());
export type WishlistIds = z.infer<typeof wishlistIdsSchema>;

/** A review shown on a public profile page, with the product it belongs to. */
export const userReviewSchema = reviewSchema.extend({
  product: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    imageUrl: z.string(),
    category: z.enum(CATEGORIES),
  }),
});
export type UserReview = z.infer<typeof userReviewSchema>;

/** Profile summary used on public profile pages. */
export const profileSummarySchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['USER', 'ADMIN']),
  createdAt: z.date(),
  isOwnProfile: z.boolean(),
  stats: z.object({
    reviewsWritten: z.number().int().nonnegative(),
    totalReviewsWritten: z.number().int().nonnegative(),
    averageRatingGiven: z.number().nullable(),
    wishlistCount: z.number().int().nonnegative(),
  }),
});
export type ProfileSummary = z.infer<typeof profileSummarySchema>;