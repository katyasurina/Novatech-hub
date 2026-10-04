import { parseWithDates } from '../lib/dates';
import { apiFetch } from './client';
import { type CreateReviewInput, type ReviewDto, type UpdateReviewInput, reviewSchema } from '@novatech/shared';

/** POST /products/:productId/reviews */
export async function createReview(productId: string, input: CreateReviewInput): Promise<ReviewDto> {
  const data = await apiFetch(`/products/${productId}/reviews`, { method: 'POST', body: input });
  return parseWithDates(reviewSchema, data);
}

/** PATCH /products/:productId/reviews/:reviewId — author only. */
export async function updateReview(
  productId: string,
  reviewId: string,
  input: UpdateReviewInput,
): Promise<ReviewDto> {
  const data = await apiFetch(`/products/${productId}/reviews/${reviewId}`, {
    method: 'PATCH',
    body: input,
  });
  return parseWithDates(reviewSchema, data);
}

/** DELETE /products/:productId/reviews/:reviewId — author or admin. */
export async function deleteReview(productId: string, reviewId: string): Promise<void> {
  await apiFetch(`/products/${productId}/reviews/${reviewId}`, { method: 'DELETE' });
}

/**
 * POST /reviews/:reviewId/vote — idempotent toggle. Voting the same value
 * removes the vote; a different value replaces it. Returns the new state.
 */
export async function voteReview(reviewId: string, value: 1 | -1): Promise<{ voteCount: number; userVote: number | null }> {
  return apiFetch(`/reviews/${reviewId}/vote`, { method: 'POST', body: { value } });
}