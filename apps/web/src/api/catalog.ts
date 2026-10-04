import { parseWithDates } from '../lib/dates';
import { paged } from '../lib/paged';
import { apiFetch } from './client';
import {
  type CatalogProduct,
  type CatalogQuery,
  type Paged,
  catalogProductSchema,
} from '@novatech/shared';

/** Builds the query string for the catalog from the shared CatalogQuery shape. */
export function catalogSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page !== undefined && query.page !== 1) params.set('page', String(query.page));
  if (query.pageSize !== undefined && query.pageSize !== 12) params.set('pageSize', String(query.pageSize));
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.category) params.set('category', query.category);
  if (query.sort && query.sort !== 'trending') params.set('sort', query.sort);
  if (query.minPrice !== undefined) params.set('minPrice', String(query.minPrice));
  if (query.maxPrice !== undefined) params.set('maxPrice', String(query.maxPrice));
  if (query.minRating !== undefined) params.set('minRating', String(query.minRating));
  return params;
}

/** GET /products — the catalog list with aggregates computed by Postgres. */
export async function fetchCatalog(query: CatalogQuery): Promise<Paged<CatalogProduct>> {
  const qs = catalogSearchParams(query).toString();
  const data = await apiFetch(`/products${qs ? `?${qs}` : ''}`);
  return parseWithDates(paged(catalogProductSchema), data);
}

/** Stable React Query key for the catalog screen (also mirrors URL state). */
export function catalogQueryKey(query: CatalogQuery): Array<string | number | undefined> {
  return [
    'catalog',
    query.page ?? 1,
    query.pageSize ?? 12,
    query.q?.trim()?.toLowerCase() ?? '',
    query.category ?? '',
    query.sort ?? 'trending',
    query.minPrice ?? '',
    query.maxPrice ?? '',
    query.minRating ?? '',
  ];
}