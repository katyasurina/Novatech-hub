import type { ReviewDto } from '@novatech/shared';

/** Flat row produced by the review-list raw queries in products.service/friends. */
export interface ReviewRow {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  status: 'VISIBLE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  authorUsername: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  voteCount: number;
  userVote: number | null;
  viewableByRequestingUser: boolean | null;
}

/**
 * Maps a raw review row to the client DTO, resolving the requesting user's own
 * vote and whether they may edit/delete it (their own, or any as an admin).
 */
export function serializeReview(
  row: ReviewRow,
  userId: string | null,
  isAdmin: boolean,
): ReviewDto {
  const isOwnReview = userId !== null && row.authorId === userId;
  return {
    id: row.id,
    productId: row.productId,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: {
      id: row.authorId,
      username: row.authorUsername,
      name: row.authorName,
      avatarUrl: row.authorAvatarUrl,
    },
    voteCount: row.voteCount,
    userVote: row.userVote,
    viewableByRequestingUser: isOwnReview || isAdmin,
  };
}