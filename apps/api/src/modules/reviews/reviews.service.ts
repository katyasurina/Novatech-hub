import { Prisma } from '@prisma/client';
import {
  type CreateReviewInput,
  type ReviewDto,
  type UpdateReviewInput,
  type VoteInput,
} from '@novatech/shared';
import { prisma } from '../../db/prisma';
import { AppError } from '../../lib/errors';
import { emitReviewCreated } from '../realtime/socket';
import { serializeReview, type ReviewRow } from './serialize';

/** One review per user per product — enforced by a unique constraint too. */
export async function createReview(
  productId: string,
  userId: string,
  input: CreateReviewInput,
): Promise<ReviewDto> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw AppError.notFound('Product not found');

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
    select: { id: true },
  });
  if (existing) throw AppError.conflict('You have already reviewed this product.');

  const review = await prisma.review.create({
    data: {
      productId,
      userId,
      rating: input.rating,
      title: input.title,
      body: input.body,
    },
  });

  const dto = await fetchReviewDto(review.id, userId, false);

  // Push a "new review" event to anyone watching this product page live.
  emitReviewCreated(productId, dto);
  return dto;
}

export async function updateReview(
  productId: string,
  reviewId: string,
  userId: string,
  input: UpdateReviewInput,
): Promise<ReviewDto> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.productId !== productId) throw AppError.notFound('Review not found');
  if (review.userId !== userId) throw AppError.forbidden('You can only edit your own review.');

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      rating: input.rating,
      title: input.title,
      body: input.body,
    },
  });
  return fetchReviewDto(reviewId, userId, false);
}

export async function deleteReview(
  productId: string,
  reviewId: string,
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.productId !== productId) throw AppError.notFound('Review not found');
  if (review.userId !== userId && !isAdmin) {
    throw AppError.forbidden('You can only delete your own review.');
  }
  await prisma.review.delete({ where: { id: reviewId } });
  // Votes are removed by the DB (onDelete: Cascade).
}

export interface VoteResult {
  voteCount: number;
  userVote: number | null;
}

/** Toggle an up/down vote. Idempotent: voting the same way again removes it. */
export async function vote(
  reviewId: string,
  userId: string,
  input: VoteInput,
): Promise<VoteResult> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, visibility: true },
  });
  if (!review || review.visibility !== 'VISIBLE') throw AppError.notFound('Review not found');

  const existing = await prisma.reviewVote.findUnique({
    where: { reviewId_userId: { reviewId, userId } },
  });

  if (existing) {
    if (existing.value === input.value) {
      await prisma.reviewVote.delete({ where: { id: existing.id } });
    } else {
      await prisma.reviewVote.update({ where: { id: existing.id }, data: { value: input.value } });
    }
  } else {
    await prisma.reviewVote.create({ data: { reviewId, userId, value: input.value } });
  }

  const [sum, mine] = await Promise.all([
    prisma.reviewVote.aggregate({ where: { reviewId }, _sum: { value: true } }),
    prisma.reviewVote.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
      select: { value: true },
    }),
  ]);
  return { voteCount: sum._sum.value ?? 0, userVote: mine?.value ?? null };
}

/** Single-row fetch reusing the list query's shape, for POST/PATCH responses. */
export async function fetchReviewDto(
  reviewId: string,
  userId: string | null,
  isAdmin: boolean,
): Promise<ReviewDto> {
  const userVoteSql = userId
    ? Prisma.sql`(SELECT ve.value FROM "ReviewVote" ve WHERE ve."reviewId" = r.id AND ve."userId" = ${userId})`
    : Prisma.sql`CAST(NULL AS int)`;

  const rows = await prisma.$queryRaw<ReviewRow[]>(Prisma.sql`
    SELECT
      r.id, r."productId" AS "productId", r.rating, r.title, r.body,
      r.visibility AS status, r."createdAt" AS "createdAt", r."updatedAt" AS "updatedAt",
      u.id AS "authorId", u.username AS "authorUsername", u.name AS "authorName",
      u."avatarUrl" AS "authorAvatarUrl",
      COALESCE(v.cnt, 0)::int AS "voteCount",
      ${userVoteSql} AS "userVote",
      (r."userId" = ${userId ?? ''} OR ${isAdmin}) AS "viewableByRequestingUser"
    FROM "Review" r
    JOIN "User" u ON u.id = r."userId"
    LEFT JOIN (
      SELECT "reviewId" AS rid, SUM(value)::int AS cnt
      FROM "ReviewVote"
      GROUP BY "reviewId"
    ) v ON v.rid = r.id
    WHERE r.id = ${reviewId}
  `);

  const row = rows[0];
  if (!row) throw AppError.notFound('Review not found');
  return serializeReview(row, userId, isAdmin);
}