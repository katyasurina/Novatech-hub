import { Prisma } from '@prisma/client';
import {
  type ProfileSummary,
  type ProfileUpdateInput,
  type PublicUser,
  type Paged,
  type UserReview,
  type ReviewsQuery,
  type WishlistItem,
  type CatalogProduct,
} from '@novatech/shared';
import { prisma } from '../../db/prisma';
import { AppError } from '../../lib/errors';
import { toPublicUser } from '../../lib/serialize';
import { serializeReview, type ReviewRow } from '../reviews/serialize';

export async function getProfileByUsername(
  username: string,
  requesterId: string | null,
): Promise<ProfileSummary> {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, username: true, name: true, bio: true, avatarUrl: true, role: true, createdAt: true },
  });
  if (!user) throw AppError.notFound('User not found');

  const [reviewStat, wishlistCount] = await Promise.all([
    prisma.review.aggregate({
      where: { userId: user.id, visibility: 'VISIBLE' },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    prisma.wishlistItem.count({ where: { userId: user.id } }),
  ]);
  const totalReviewsWritten = await prisma.review.count({ where: { userId: user.id } });

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt,
    isOwnProfile: requesterId !== null && requesterId === user.id,
    stats: {
      reviewsWritten: reviewStat._count._all,
      totalReviewsWritten,
      averageRatingGiven: reviewStat._avg.rating ?? null,
      wishlistCount,
    },
  };
}

/** Own full profile (email included) + aggregate stats, for the edit screen. */
export async function getOwnProfile(userId: string): Promise<PublicUser & { stats: ProfileSummary['stats'] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, username: true, name: true, bio: true,
      avatarUrl: true, role: true, createdAt: true,
    },
  });
  if (!user) throw AppError.notFound('User not found');

  const [reviewStat] = await Promise.all([
    prisma.review.aggregate({
      where: { userId, visibility: 'VISIBLE' },
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);
  const [totalReviewsWritten, wishlistCount] = await Promise.all([
    prisma.review.count({ where: { userId } }),
    prisma.wishlistItem.count({ where: { userId } }),
  ]);

  return {
    ...toPublicUser(user),
    stats: {
      reviewsWritten: reviewStat._count._all,
      totalReviewsWritten,
      averageRatingGiven: reviewStat._avg.rating ?? null,
      wishlistCount,
    },
  };
}

export async function updateProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<PublicUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name !== undefined ? input.name : undefined,
      bio: input.bio !== undefined ? input.bio : undefined,
    },
    select: {
      id: true, email: true, username: true, name: true, bio: true,
      avatarUrl: true, role: true, createdAt: true,
    },
  });
  return toPublicUser(user);
}

/** Attach an uploaded avatar, replacing any previous one. */
export async function setAvatar(userId: string, mediaUrl: string): Promise<PublicUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: mediaUrl },
    select: {
      id: true, email: true, username: true, name: true, bio: true,
      avatarUrl: true, role: true, createdAt: true,
    },
  });
  return toPublicUser(user);
}

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { product: true },
  });

  const productIds = rows.map((r) => r.productId);
  const groups = productIds.length
    ? await prisma.review.groupBy({
        by: ['productId', 'rating'],
        where: { productId: { in: productIds }, visibility: 'VISIBLE' },
        _count: { _all: true },
      })
    : [];

  const summary = new Map<string, { avg: number | null; count: number }>();
  for (const id of productIds) summary.set(id, { avg: null, count: 0 });
  const running: Record<string, { sum: number; count: number }> = {};
  for (const g of groups) {
    const acc = (running[g.productId] ??= { sum: 0, count: 0 });
    acc.sum += g.rating * g._count._all;
    acc.count += g._count._all;
  }
  for (const [id, acc] of Object.entries(running)) {
    summary.set(id, { avg: acc.count ? round1(acc.sum / acc.count) : null, count: acc.count });
  }

  return rows.map((row) => {
    const agg = summary.get(row.productId)!;
    const p = row.product;
    const product: CatalogProduct = {
      id: p.id, slug: p.slug, name: p.name, tagline: p.tagline, category: p.category,
      brand: p.brand, priceMinor: p.priceMinor, currency: p.currency, imageUrl: p.imageUrl,
      featured: p.featured, releaseDate: p.releaseDate, createdAt: p.createdAt,
      averageRating: agg.avg, reviewCount: agg.count,
    };
    return { addedAt: row.createdAt, product };
  });
}

export async function addWishlistItem(userId: string, productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw AppError.notFound('Product not found');
  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
}

export async function removeWishlistItem(userId: string, productId: string): Promise<void> {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
}

// ---------------------------------------------------------------------------
// Reviews written by a user (public profile's review list)
// ---------------------------------------------------------------------------

export async function listUserReviews(
  username: string,
  rawQuery: ReviewsQuery,
  ctx: { userId: string | null; isAdmin: boolean },
): Promise<Paged<UserReview>> {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });
  if (!user) throw AppError.notFound('User not found');

  const { page, pageSize } = rawQuery;
  const userId = ctx.userId;
  const userVoteSql = userId
    ? Prisma.sql`(SELECT ve.value FROM "ReviewVote" ve WHERE ve."reviewId" = r.id AND ve."userId" = ${userId})`
    : Prisma.sql`CAST(NULL AS int)`;

  const orderBy: Record<ReviewsQuery['sort'], Prisma.Sql> = {
    newest: Prisma.sql`r."createdAt" DESC, r.id DESC`,
    highest: Prisma.sql`r.rating DESC, r."createdAt" DESC`,
    lowest: Prisma.sql`r.rating ASC, r."createdAt" DESC`,
    helpful: Prisma.sql`COALESCE(v.cnt, 0) DESC, r."createdAt" DESC`,
  };

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<Array<ReviewRow & {
      productId: string; productSlug: string; productName: string;
      productImageUrl: string; productCategory: string;
    }>>(Prisma.sql`
      SELECT
        r.id, r."productId" AS "productId", r.rating, r.title, r.body,
        r.visibility AS status, r."createdAt" AS "createdAt", r."updatedAt" AS "updatedAt",
        u.id AS "authorId", u.username AS "authorUsername", u.name AS "authorName",
        u."avatarUrl" AS "authorAvatarUrl",
        COALESCE(v.cnt, 0)::int AS "voteCount",
        ${userVoteSql} AS "userVote",
        (r."userId" = ${userId ?? ''} OR ${ctx.isAdmin}) AS "viewableByRequestingUser",
        p.slug AS "productSlug", p.name AS "productName",
        p."imageUrl" AS "productImageUrl", p.category::text AS "productCategory"
      FROM "Review" r
      JOIN "User" u ON u.id = r."userId"
      JOIN "Product" p ON p.id = r."productId"
      LEFT JOIN (
        SELECT "reviewId" AS rid, SUM(value)::int AS cnt
        FROM "ReviewVote"
        GROUP BY "reviewId"
      ) v ON v.rid = r.id
      WHERE r."userId" = ${user.id} AND r.visibility = 'VISIBLE'
      ORDER BY ${orderBy[rawQuery.sort] ?? orderBy.newest}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `),
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Review" r
      WHERE r."userId" = ${user.id} AND r.visibility = 'VISIBLE'
    `),
  ]);

  const total = countRows[0]?.total ?? 0;
  return {
    items: rows.map((row) => ({
      ...serializeReview(row, userId, ctx.isAdmin),
      product: {
        id: row.productId,
        slug: row.productSlug,
        name: row.productName,
        imageUrl: row.productImageUrl,
        category: row.productCategory as UserReview['product']['category'],
      },
    })),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}