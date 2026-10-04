import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';
import {
  type AdminStats,
  type ModerationItem,
  type ProductUpdateInput,
  type ProductUpsertInput,
} from '@novatech/shared';
import { prisma } from '../../db/prisma';
import { AppError } from '../../lib/errors';

const here = dirname(fileURLToPath(import.meta.url));
const PRODUCT_ART_DIR = resolve(here, '../../../uploads/products');

export async function getAdminStats(): Promise<AdminStats> {
  const [users, products, reviews, suspendedReviews, wishlistItems, categoryGroups, overTime, topRated] =
    await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.review.count(),
      prisma.review.count({ where: { visibility: 'SUSPENDED' } }),
      prisma.wishlistItem.count(),
      prisma.product.groupBy({ by: ['category'], _count: { _all: true } }),
      prisma.$queryRaw<Array<{ date: string; count: number; averageRating: number | null }>>(
        Prisma.sql`
          SELECT
            to_char(("createdAt" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date,
            COUNT(*)::int AS count,
            ROUND(AVG(rating)::numeric, 1)::float8 AS "averageRating"
          FROM "Review"
          WHERE "createdAt" >= now() - (30 * INTERVAL '1 day')
          GROUP BY 1
          ORDER BY 1
        `,
      ),
      prisma.$queryRaw<
        Array<{ slug: string; name: string; averageRating: number | null; reviewCount: number }>
      >(Prisma.sql`
        SELECT p.slug, p.name,
          COALESCE(agg."averageRating", 0) AS "averageRating",
          COALESCE(agg."reviewCount", 0)::int AS "reviewCount"
        FROM "Product" p
        LEFT JOIN (
          SELECT r."productId" AS pid,
            ROUND(AVG(r.rating)::numeric, 1)::float8 AS "averageRating",
            COUNT(*)::int AS "reviewCount"
          FROM "Review" r WHERE r.visibility = 'VISIBLE'
          GROUP BY r."productId"
        ) agg ON agg.pid = p.id
        ORDER BY COALESCE(agg."averageRating", 0) DESC
        LIMIT 10
      `),
    ]);

  return {
    totals: { users, products, reviews, suspendedReviews, wishlistItems },
    reviewsOverTime: overTime,
    categoryDistribution: categoryGroups.map((g) => ({ category: g.category, count: g._count._all })),
    topRated,
  };
}

// ---------------------------------------------------------------------------
// Product CRUD
// ---------------------------------------------------------------------------

export interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  priceMinor: number;
  currency: string;
  imageUrl: string;
  featured: boolean;
  createdAt: Date;
  visibleReviews: number;
}

export async function listAdminProducts(
  page: number,
  pageSize: number,
): Promise<{ items: AdminProductRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, slug: true, name: true, category: true, priceMinor: true,
        currency: true, imageUrl: true, featured: true, createdAt: true,
        _count: { select: { reviews: { where: { visibility: 'VISIBLE' } } } },
      },
    }),
    prisma.product.count(),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id, slug: r.slug, name: r.name, category: r.category, priceMinor: r.priceMinor,
      currency: r.currency, imageUrl: r.imageUrl, featured: r.featured, createdAt: r.createdAt,
      visibleReviews: r._count.reviews,
    })),
    total,
  };
}

export async function createProduct(input: ProductUpsertInput): Promise<AdminProductRow> {
  const slug = await ensureUniqueSlug(input.slug, null);
  const imageUrl = input.imageUrl || generatePlaceholderArt(input.name, input.brand);

  const product = await prisma.product.create({
    data: {
      slug,
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      category: input.category,
      brand: input.brand,
      priceMinor: input.priceMinor,
      currency: input.currency,
      imageUrl,
      galleryUrls: input.galleryUrls,
      featured: input.featured,
      releaseDate: input.releaseDate ?? null,
      specs: input.specs,
    },
  });
  return toAdminProduct(product);
}

export async function updateProduct(id: string, input: ProductUpdateInput): Promise<AdminProductRow> {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('Product not found');

  const slug = input.slug !== undefined ? await ensureUniqueSlug(input.slug, id) : undefined;
  const imageUrl = input.imageUrl;
  const product = await prisma.product.update({
    where: { id },
    data: {
      slug,
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      category: input.category,
      brand: input.brand,
      priceMinor: input.priceMinor,
      currency: input.currency,
      imageUrl: imageUrl === '' ? generatePlaceholderArt(input.name ?? 'Product') : imageUrl,
      galleryUrls: input.galleryUrls,
      featured: input.featured,
      releaseDate: input.releaseDate,
      specs: input.specs,
    },
  });
  return toAdminProduct(product);
}

export async function deleteProduct(id: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) throw AppError.notFound('Product not found');
  // Reviews, votes and wishlist rows cascade (schema-level onDelete: Cascade).
  await prisma.product.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Review moderation
// ---------------------------------------------------------------------------

export async function listModerationQueue(params: {
  page: number;
  pageSize: number;
  status?: 'VISIBLE' | 'SUSPENDED';
}): Promise<{ items: ModerationItem[]; total: number }> {
  const statusClause =
    params.status !== undefined
      ? Prisma.sql`r.visibility = CAST(${params.status} AS "ReviewVisibility")`
      : Prisma.sql`TRUE`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<ModerationItem[]>(Prisma.sql`
      SELECT
        r.id, r.rating, r.title, r.body, r.visibility AS status,
        r."createdAt" AS "createdAt",
        json_build_object('id', p.id, 'slug', p.slug, 'name', p.name) AS product,
        json_build_object('id', u.id, 'username', u.username, 'avatarUrl', u."avatarUrl") AS author
      FROM "Review" r
      JOIN "Product" p ON p.id = r."productId"
      JOIN "User" u ON u.id = r."userId"
      WHERE ${statusClause}
      ORDER BY r."createdAt" DESC
      LIMIT ${params.pageSize} OFFSET ${(params.page - 1) * params.pageSize}
    `),
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Review" r
      WHERE ${statusClause}
    `),
  ]);

  return { items: rows, total: countRows[0]?.total ?? 0 };
}

export async function setReviewStatus(reviewId: string, status: 'VISIBLE' | 'SUSPENDED'): Promise<void> {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { id: true } });
  if (!review) throw AppError.notFound('Review not found');
  await prisma.review.update({ where: { id: reviewId }, data: { visibility: status } });
}

export async function deleteReview(reviewId: string): Promise<void> {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { id: true } });
  if (!review) throw AppError.notFound('Review not found');
  await prisma.review.delete({ where: { id: reviewId } });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureUniqueSlug(slug: string, excludeId: string | null): Promise<string> {
  const base = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
  let candidate = base;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${i++}`;
  }
}

function toAdminProduct(p: {
  id: string; slug: string; name: string; category: string; priceMinor: number;
  currency: string; imageUrl: string; featured: boolean; createdAt: Date;
}): AdminProductRow {
  return {
    id: p.id, slug: p.slug, name: p.name, category: p.category, priceMinor: p.priceMinor,
    currency: p.currency, imageUrl: p.imageUrl, featured: p.featured, createdAt: p.createdAt,
    visibleReviews: 0, // a brand-new product has none
  };
}

/**
 * Generate a simple branded SVG placeholder so admin-created products always
 * have art, offline, with zero external dependencies.
 *
 * One neutral template for every product — transparent background over the
 * card's slate gradient, soft indigo/violet accent, initials + brand — so
 * admin-created products match the seeded catalogue exactly. No name hash, no
 * category colours.
 */
function generatePlaceholderArt(name: string, brandInput?: string): string {
  mkdirSync(PRODUCT_ART_DIR, { recursive: true });
  const brand = brandInput ?? name.slice(0, 12);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${name}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4338ca"/>
      <stop offset="1" stop-color="#6d28d9"/>
    </linearGradient>
  </defs>
  <circle cx="400" cy="250" r="150" fill="url(#g)" opacity="0.16"/>
  <circle cx="400" cy="250" r="96"  fill="url(#g)" opacity="0.24"/>
  <text x="400" y="272" text-anchor="middle" font-family="system-ui,sans-serif" font-size="64" font-weight="700" fill="#e2e8f0">${initials}</text>
  <text x="400" y="470" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" letter-spacing="2" fill="#94a3b8">${brand.toUpperCase()}</text>
</svg>`;

  const slug = `${Date.now()}-${randomUUID()}`;
  writeFileSync(resolve(PRODUCT_ART_DIR, `${slug}.svg`), svg, 'utf8');
  return `/media/products/${slug}.svg`;
}