import { z } from 'zod';
import { CATEGORIES, CATALOG_SORTS } from '../constants';

/**
 * parse a query-string number. Query strings arrive as strings; '' / null
 * mean "absent". Failures fall through to the min check instead of
 * bubbling a "expected number, received string" zoo.
 */
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

export const catalogQuerySchema = z.object({
  page: numFromQuery(1, undefined, 1),
  pageSize: numFromQuery(1, 48, 12),
  q: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  sort: z.enum(CATALOG_SORTS).default('trending'),
  minPrice: numFromQuery(0, 20_000),
  maxPrice: numFromQuery(0, 20_000),
  minRating: numFromQuery(1, 10),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

/** The product row shape returned by the catalog list (aggregates included). */
export const catalogProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  category: z.enum(CATEGORIES),
  brand: z.string(),
  priceMinor: z.number().int().nonnegative(),
  currency: z.string(),
  imageUrl: z.string(),
  featured: z.boolean(),
  releaseDate: z.date().nullable(),
  createdAt: z.date(),
  /** Computed at query time by Postgres — never stored. */
  averageRating: z.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
});
export type CatalogProduct = z.infer<typeof catalogProductSchema>;

/** Generic paginated envelope used by every list endpoint. */
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export type Paged<T> = { items: T[] } & PageMeta;