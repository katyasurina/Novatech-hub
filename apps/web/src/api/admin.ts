import { parseWithDates } from '../lib/dates';
import { paged } from '../lib/paged';
import { apiFetch } from './client';
import {
  type AdminStats,
  type ModerationItem,
  type ProductUpdateInput,
  type ProductUpsertInput,
  type Paged,
  type SetReviewStatusInput,
  adminStatsSchema,
  moderationItemSchema,
} from '@novatech/shared';

/** Admin product row is an API-side shape (PRM catalog + visible review count). */
export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  priceMinor: number;
  currency: string;
  imageUrl: string;
  featured: boolean;
  createdAt: string;
  visibleReviews: number;
}

/** GET /admin/stats — the dashboard aggregates. */
export async function fetchAdminStats(): Promise<AdminStats> {
  const data = await apiFetch('/admin/stats');
  return parseWithDates(adminStatsSchema, data);
}

/** GET /admin/products?page&pageSize */
export async function fetchAdminProducts(page = 1, pageSize = 20): Promise<Paged<AdminProduct>> {
  const data = await apiFetch(`/admin/products?page=${page}&pageSize=${pageSize}`);
  const pageData = data as { page: number; pageSize: number; total: number; totalPages: number; items: unknown[] };
  return {
    page: pageData.page,
    pageSize: pageData.pageSize,
    total: pageData.total,
    totalPages: pageData.totalPages,
    items: pageData.items as AdminProduct[],
  };
}

/** POST /admin/products */
export async function createAdminProduct(input: ProductUpsertInput): Promise<AdminProduct> {
  return apiFetch('/admin/products', { method: 'POST', body: input });
}

/** PUT /admin/products/:id */
export async function updateAdminProduct(
  id: string,
  input: ProductUpdateInput,
): Promise<AdminProduct> {
  return apiFetch(`/admin/products/${id}`, { method: 'PUT', body: input });
}

/** DELETE /admin/products/:id — cascades reviews + wishlist rows. */
export async function deleteAdminProduct(id: string): Promise<void> {
  await apiFetch(`/admin/products/${id}`, { method: 'DELETE' });
}

/** GET /admin/reviews?status&page&pageSize — the moderation queue. */
export async function fetchModerationQueue(params: {
  page?: number;
  pageSize?: number;
  status?: 'VISIBLE' | 'SUSPENDED';
}): Promise<Paged<ModerationItem>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  const data = await apiFetch(`/admin/reviews${qs ? `?${qs}` : ''}`);
  return parseWithDates(paged(moderationItemSchema), data);
}

/** PUT /admin/reviews/:id/status — suspend or restore a review. */
export async function setReviewStatus(id: string, status: SetReviewStatusInput['status']): Promise<void> {
  await apiFetch(`/admin/reviews/${id}/status`, { method: 'PUT', body: { status } });
}

/** DELETE /admin/reviews/:id — hard delete. */
export async function deleteReviewAsAdmin(id: string): Promise<void> {
  await apiFetch(`/admin/reviews/${id}`, { method: 'DELETE' });
}