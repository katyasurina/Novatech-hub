import { parseWithDates } from '../lib/dates';
import { paged } from '../lib/paged';
import { apiFetch } from './client';
import {
  type Paged,
  type ProductDetail,
  type ReviewDto,
  type ReviewsQuery,
  type ReviewSummary,
  productDetailSchema,
  reviewSchema,
  reviewSummarySchema,
} from '@novatech/shared';

export interface ProductDetailPayload {
  product: ProductDetail;
  summary: ReviewSummary;
}

/** GET /products/:slug — detail plus a live rating summary + histogram. */
export async function fetchProductDetail(slug: string): Promise<ProductDetailPayload> {
  const data = (await apiFetch(`/products/${encodeURIComponent(slug)}`)) as {
    product: unknown;
    summary: unknown;
  };
  return {
    product: parseWithDates(productDetailSchema, data.product),
    summary: parseWithDates(reviewSummarySchema, data.summary),
  };
}

/** GET /products/:productId/reviews?page&pageSize&sort */
export async function fetchReviews(
  productId: string,
  query: ReviewsQuery,
): Promise<Paged<ReviewDto>> {
  const params = new URLSearchParams();
  if (query.page && query.page !== 1) params.set('page', String(query.page));
  if (query.pageSize && query.pageSize !== 8) params.set('pageSize', String(query.pageSize));
  if (query.sort && query.sort !== 'newest') params.set('sort', query.sort);
  const qs = params.toString();
  const data = await apiFetch(`/products/${productId}/reviews${qs ? `?${qs}` : ''}`);
  return parseWithDates(paged(reviewSchema), data);
}