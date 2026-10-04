import { z } from 'zod';
import {
  REVIEW_SORTS,
  MIN_RATING,
  MAX_RATING,
  REVIEW_TITLE_MIN,
  REVIEW_TITLE_MAX,
  REVIEW_BODY_MIN,
  REVIEW_BODY_MAX,
  REVIEW_STATUSES,
} from '../constants';
import { reviewAuthorSchema } from './auth';

const numFromQuery = (
  min?: number,
  max?: number,
  fallback?: number,
) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === '') return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    },
    z.union([
      (fallback !== undefined ? z.literal(fallback) : z.undefined()) as z.ZodTypeAny,
      z.number().int().min(min ?? -Infinity).max(max ?? Infinity),
      z.undefined(),
    ]),
  );

export const reviewsQuerySchema = z.object({
  page: numFromQuery(1, undefined, 1),
  pageSize: numFromQuery(1, 20, 8),
  sort: z.enum(REVIEW_SORTS).default('newest'),
});
export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;

export const createReviewSchema = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(MIN_RATING, `Rating must be between ${MIN_RATING} and ${MAX_RATING}`)
    .max(MAX_RATING, `Rating must be between ${MIN_RATING} and ${MAX_RATING}`),
  title: z
    .string()
    .trim()
    .min(REVIEW_TITLE_MIN, `Title must be at least ${REVIEW_TITLE_MIN} characters`)
    .max(REVIEW_TITLE_MAX),
  body: z
    .string()
    .trim()
    .min(REVIEW_BODY_MIN, `Review must be at least ${REVIEW_BODY_MIN} characters`)
    .max(REVIEW_BODY_MAX),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = createReviewSchema.partial();
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

/** +1 / -1 vote on a review. */
export const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});
export type VoteInput = z.infer<typeof voteSchema>;

/** Review DTO as returned to the client (author + own-vote resolved). */
export const reviewSchema = z.object({
  id: z.string(),
  productId: z.string(),
  rating: z.number().int().min(MIN_RATING).max(MAX_RATING),
  title: z.string(),
  body: z.string(),
  status: z.enum(REVIEW_STATUSES),
  createdAt: z.date(),
  updatedAt: z.date(),
  author: reviewAuthorSchema,
  /** Derived from the aggregate of ReviewVote rows. */
  voteCount: z.number().int(),
  /** +1 / -1 if the requesting user voted, else null. */
  userVote: z.number().nullable(),
  /** True when the requesting user is the author or an admin. */
  viewableByRequestingUser: z.boolean(),
});
export type ReviewDto = z.infer<typeof reviewSchema>;