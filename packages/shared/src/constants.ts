/**
 * Shared domain constants. Single source of truth for enums, rating scale and
 * pagination limits — imported by both the API (validation, sorting keys) and
 * the web app (filters, labels, form constraints).
 */

export const CATEGORIES = [
  'AUDIO',
  'WEARABLES',
  'SMART_HOME',
  'MOBILE',
  'COMPUTING',
  'PHOTOGRAPHY',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  AUDIO: 'Audio',
  WEARABLES: 'Wearables',
  SMART_HOME: 'Smart Home',
  MOBILE: 'Mobile & Accessories',
  COMPUTING: 'Computing',
  PHOTOGRAPHY: 'Photography',
};

/** Catalog sort keys. The same enum validations both the query API and the UI select. */
export const CATALOG_SORTS = [
  'trending',
  'newest',
  'top_rated',
  'most_reviewed',
  'price_asc',
  'price_desc',
] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** Review list sort keys. */
export const REVIEW_SORTS = ['newest', 'highest', 'lowest', 'helpful'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

/** The rating scale is 1–10 (not the common 0–5) — see README for why. */
export const MIN_RATING = 1;
export const MAX_RATING = 10;

export const REVIEW_TITLE_MIN = 4;
export const REVIEW_TITLE_MAX = 120;
export const REVIEW_BODY_MIN = 20;
export const REVIEW_BODY_MAX = 2000;
export const REVIEW_BODY_CHARS_HINT = 20;

export const BIO_MAX = 500;
export const NAME_MAX = 40;

/** Username: 3–20 chars, alphanumeric + underscore. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;
export const USERNAME_MIN = 3;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt input ceiling

/** Money is stored as integer minor units (cents) — never floats for money. */
export const CURRENCY = 'USD';
export const PRICE_MAX_USD = 1_000_000;

export const PAGE_SIZE_DEFAULT = 12;
export const PAGE_SIZE_MAX = 48;
export const CATALOG_PAGE_SIZES = [12, 24, 48] as const;

/** Admin moderator action types for reviews. */
export const REVIEW_STATUSES = ['VISIBLE', 'SUSPENDED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const DEFAULT_AVATAR = '/media/avatars/default.svg';