import { Prisma } from '@prisma/client';
import {
  type CatalogProduct,
  type CatalogQuery,
  type Paged,
  type ProductDetail,
  type ReviewsQuery,
  type ReviewDto,
  type ReviewSummary,
  CATEGORIES,
  CATALOG_SORTS,
  MIN_RATING,
  MAX_RATING,
} from '@novatech/shared';
import { prisma } from '../../db/prisma';
import { AppError } from '../../lib/errors';
import { sqlAggregates, sqlTrendingTotal } from '../trending/score';
import { serializeReview, type ReviewRow } from '../reviews/serialize';

/** Raw catalog row mirrors the aliases in the SQL below. */
interface CatalogRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: (typeof CATEGORIES)[number];
  brand: string;
  priceMinor: number;
  currency: string;
  imageUrl: string;
  featured: boolean;
  releaseDate: Date | null;
  createdAt: Date;
  averageRating: number | null;
  reviewCount: number;
}

const AVG_ALIAS: { productsTable: 'p'; aggTable: 'agg' } = {
  productsTable: 'p',
  aggTable: 'agg',
};

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/**
 * The catalog list. Average rating, review count and the trending score are all
 * computed by Postgres in a single pass (a LEFT JOIN over a grouped aggregate
 * subquery) — nothing is stored on the product row and nothing is hardcoded.
 */
export async function listCatalog(rawQuery: CatalogQuery): Promise<Paged<CatalogProduct>> {
  const { page, pageSize } = rawQuery;

  // Money is stored in cents; the schema converts to/from USD.
  const minPriceMinor = rawQuery.minPrice !== undefined ? Math.round(rawQuery.minPrice * 100) : undefined;
  const maxPriceMinor = rawQuery.maxPrice !== undefined ? Math.round(rawQuery.maxPrice * 100) : undefined;

  const where = buildWhere(rawQuery, minPriceMinor, maxPriceMinor);

  const [rows, count] = await Promise.all([
    prisma.$queryRaw<CatalogRow[]>(Prisma.sql`
      SELECT
        p.id, p.slug, p.name, p.tagline, p.category, p.brand,
        p."priceMinor" AS "priceMinor",
        p.currency, p."imageUrl" AS "imageUrl",
        p.featured, p."releaseDate" AS "releaseDate", p."createdAt" AS "createdAt",
        COALESCE(agg."averageRating", 0) AS "averageRating",
        COALESCE(agg."reviewCount", 0) AS "reviewCount"
      FROM "Product" p
      ${Prisma.raw(sqlAggregates('agg'))}
      ${where}
      ${orderBy(rawQuery.sort)}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `),
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Product" p
      ${Prisma.raw(sqlAggregates('agg'))}
      ${where}
    `),
  ]);

  const total = count[0]?.total ?? 0;
  return {
    items: rows,
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function buildWhere(
  q: CatalogQuery,
  minPriceMinor?: number,
  maxPriceMinor?: number,
): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];

  if (q.category) {
    clauses.push(Prisma.sql`p.category = CAST(${q.category} AS "Category")`);
  }
  if (minPriceMinor !== undefined) {
    clauses.push(Prisma.sql`p."priceMinor" >= ${minPriceMinor}`);
  }
  if (maxPriceMinor !== undefined) {
    clauses.push(Prisma.sql`p."priceMinor" <= ${maxPriceMinor}`);
  }
  if (q.minRating !== undefined) {
    clauses.push(Prisma.sql`COALESCE(agg."averageRating", 0) >= ${q.minRating}`);
  }
  if (q.q) {
    // Escape LIKE metacharacters so user input can't turn into a wildcard.
    const like = `%${q.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
    clauses.push(Prisma.sql`(
      p.name ILIKE ${like} ESCAPE '\\'
      OR p.tagline ILIKE ${like} ESCAPE '\\'
      OR p.brand ILIKE ${like} ESCAPE '\\'
      OR p.description ILIKE ${like} ESCAPE '\\'
    )`);
  }

  if (clauses.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
}

const ORDER_BY: Record<(typeof CATALOG_SORTS)[number], string> = {
  trending: `ORDER BY ${sqlTrendingTotal('agg', 'p')} DESC, p."createdAt" DESC`,
  newest: `ORDER BY p."createdAt" DESC, p.id DESC`,
  top_rated: `ORDER BY COALESCE(agg."averageRating", 0) DESC, COALESCE(agg."reviewCount", 0) DESC, p."createdAt" DESC`,
  most_reviewed: `ORDER BY COALESCE(agg."reviewCount", 0) DESC, p."createdAt" DESC`,
  price_asc: `ORDER BY p."priceMinor" ASC, p."createdAt" DESC`,
  price_desc: `ORDER BY p."priceMinor" DESC, p."createdAt" DESC`,
};

function orderBy(sort: CatalogQuery['sort']): Prisma.Sql {
  return Prisma.raw(ORDER_BY[sort] ?? ORDER_BY.trending);
}

// ---------------------------------------------------------------------------
// Product detail (with a live rating summary + histogram)
// ---------------------------------------------------------------------------

export interface ProductDetailWithSummary {
  product: ProductDetail;
  summary: ReviewSummary;
}

export async function getProductDetail(
  slug: string,
): Promise<ProductDetailWithSummary> {
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) throw AppError.notFound('Product not found');

  const groups = await prisma.review.groupBy({
    by: ['rating'],
    where: { productId: product.id, visibility: 'VISIBLE' },
    _count: { _all: true },
  });

  // Build the 1..10 histogram and derive average/count from the same data —
  // every number on the page is a live aggregate, never a stored field.
  const histogram: Record<string, number> = {};
  let count = 0;
  let weightedSum = 0;
  for (const g of groups) {
    const n = g._count._all;
    histogram[String(g.rating)] = n;
    count += n;
    weightedSum += g.rating * n;
  }

  return {
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      tagline: product.tagline,
      description: product.description,
      category: product.category,
      brand: product.brand,
      priceMinor: product.priceMinor,
      currency: product.currency,
      imageUrl: product.imageUrl,
      galleryUrls: product.galleryUrls,
      specs: product.specs as Record<string, string>,
      releaseDate: product.releaseDate,
      featured: product.featured,
      createdAt: product.createdAt,
      averageRating: count > 0 ? round1(weightedSum / count) : null,
      reviewCount: count,
    },
    summary: {
      average: count > 0 ? round1(weightedSum / count) : null,
      count,
      histogram,
    },
  };
}

// ---------------------------------------------------------------------------
// Reviews (paginated, with per-user vote resolution)
// ---------------------------------------------------------------------------

export interface ReviewsContext {
  userId: string | null;
  isAdmin: boolean;
}

const REVIEW_ORDER_BY: Record<ReviewsQuery['sort'], Prisma.Sql> = {
  newest: Prisma.sql`r."createdAt" DESC, r.id DESC`,
  highest: Prisma.sql`r.rating DESC, r."createdAt" DESC`,
  lowest: Prisma.sql`r.rating ASC, r."createdAt" DESC`,
  helpful: Prisma.sql`COALESCE(v.cnt, 0) DESC, r."createdAt" DESC`,
};

export async function listReviews(
  productId: string,
  rawQuery: ReviewsQuery,
  ctx: ReviewsContext,
): Promise<Paged<ReviewDto>> {
  const { page, pageSize } = rawQuery;
  const userId = ctx.userId;

  const userVoteSql = userId
    ? Prisma.sql`(SELECT ve.value FROM "ReviewVote" ve WHERE ve."reviewId" = r.id AND ve."userId" = ${userId})`
    : Prisma.sql`CAST(NULL AS int)`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<ReviewRow[]>(Prisma.sql`
      SELECT
        r.id, r."productId" AS "productId", r.rating, r.title, r.body,
        r.visibility AS status, r."createdAt" AS "createdAt", r."updatedAt" AS "updatedAt",
        u.id AS "authorId", u.username AS "authorUsername", u.name AS "authorName",
        u."avatarUrl" AS "authorAvatarUrl",
        COALESCE(v.cnt, 0)::int AS "voteCount",
        ${userVoteSql} AS "userVote",
        (r."userId" = ${userId ?? ''} OR ${ctx.isAdmin}) AS "viewableByRequestingUser"
      FROM "Review" r
      JOIN "User" u ON u.id = r."userId"
      LEFT JOIN (
        SELECT "reviewId" AS rid, SUM(value)::int AS cnt
        FROM "ReviewVote"
        GROUP BY "reviewId"
      ) v ON v.rid = r.id
      WHERE r."productId" = ${productId} AND r.visibility = 'VISIBLE'
      ORDER BY ${REVIEW_ORDER_BY[rawQuery.sort] ?? REVIEW_ORDER_BY.newest}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `),
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Review" r
      WHERE r."productId" = ${productId} AND r.visibility = 'VISIBLE'
    `),
  ]);

  const total = countRows[0]?.total ?? 0;
  return {
    items: rows.map((row) => serializeReview(row, userId, ctx.isAdmin)),
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export { MAX_RATING, MIN_RATING };