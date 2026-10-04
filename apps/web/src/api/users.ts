import { z } from 'zod';
import { parseWithDates } from '../lib/dates';
import { paged } from '../lib/paged';
import { apiFetch } from './client';
import {
  type ProfileSummary,
  type ProfileUpdateInput,
  type PublicUser,
  type UserReview,
  type WishlistItem,
  type Paged,
  type ReviewsQuery,
  profileSummarySchema,
  publicUserSchema,
  userReviewSchema,
  wishlistItemSchema,
} from '@novatech/shared';

/** GET /users/:username — public profile + aggregate stats. */
export async function fetchProfile(username: string): Promise<ProfileSummary> {
  const data = await apiFetch(`/users/${encodeURIComponent(username)}`);
  return parseWithDates(profileSummarySchema, data);
}

/** GET /users/:username/reviews — paginated, product included per review. */
export async function fetchUserReviews(
  username: string,
  query: ReviewsQuery,
): Promise<Paged<UserReview>> {
  const params = new URLSearchParams();
  if (query.page && query.page !== 1) params.set('page', String(query.page));
  if (query.pageSize && query.pageSize !== 8) params.set('pageSize', String(query.pageSize));
  if (query.sort && query.sort !== 'newest') params.set('sort', query.sort);
  const qs = params.toString();
  const data = await apiFetch(`/users/${encodeURIComponent(username)}/reviews${qs ? `?${qs}` : ''}`);
  return parseWithDates(paged(userReviewSchema), data);
}

/** PATCH /users/me — name / bio updates. */
export async function updateProfile(input: ProfileUpdateInput): Promise<PublicUser> {
  const data = await apiFetch('/users/me', { method: 'PATCH', body: input });
  return parseWithDates(publicUserSchema, data);
}

/** POST /users/me/avatar — multipart upload, field name "avatar". */
export async function uploadAvatar(file: File): Promise<PublicUser> {
  const form = new FormData();
  form.append('avatar', file, file.name);
  const data = await apiFetch('/users/me/avatar', { method: 'POST', form });
  return parseWithDates(publicUserSchema, data);
}

/** GET /users/me/wishlist — full rows with live per-product aggregates. */
export async function fetchWishlist(): Promise<WishlistItem[]> {
  const data = await apiFetch('/users/me/wishlist');
  return parseWithDates(z.array(wishlistItemSchema), data);
}

/** PUT /users/me/wishlist/:productId — idempotent add. */
export async function addToWishlist(productId: string): Promise<void> {
  await apiFetch(`/users/me/wishlist/${productId}`, { method: 'PUT' });
}

/** DELETE /users/me/wishlist/:productId — idempotent remove. */
export async function removeFromWishlist(productId: string): Promise<void> {
  await apiFetch(`/users/me/wishlist/${productId}`, { method: 'DELETE' });
}