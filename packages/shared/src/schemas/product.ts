import { z } from 'zod';
import { CATEGORIES } from '../constants';

/** Product detail payload (full specs object + gallery, no aggregates). */
export const productDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  category: z.enum(CATEGORIES),
  brand: z.string(),
  priceMinor: z.number().int().nonnegative(),
  currency: z.string(),
  imageUrl: z.string(),
  galleryUrls: z.array(z.string()),
  specs: z.record(z.string(), z.string()),
  releaseDate: z.date().nullable(),
  featured: z.boolean(),
  createdAt: z.date(),
  averageRating: z.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const reviewSummarySchema = z.object({
  average: z.number().nullable(),
  count: z.number().int().nonnegative(),
  /** rating bucket -> count, e.g. { "1": 0, ..., "10": 3 } */
  histogram: z.record(z.string(), z.number().int().nonnegative()),
});
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;

/** Admin product create/update payload. */
export const productUpsertSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Slug must be kebab-case, e.g. "nova-x1"'),
  tagline: z.string().trim().max(160),
  description: z.string().trim().min(20, 'Description must be at least 20 characters').max(4000),
  category: z.enum(CATEGORIES),
  brand: z.string().trim().min(1).max(60),
  priceMinor: z.coerce.number().int().positive('Price must be positive'),
  currency: z.string().length(3).default('USD'),
  imageUrl: z
    .string()
    .url('Image URL must be valid')
    .or(z.literal('')),
  galleryUrls: z.array(z.string().url()).max(6).default([]),
  featured: z.boolean().default(false),
  releaseDate: z.coerce.date().nullable().optional(),
  specs: z
    .record(z.string().min(1).max(40), z.string().min(1).max(120))
    .refine((s) => Object.keys(s).length <= 16, { message: 'At most 16 spec rows' })
    .default({}),
});
export type ProductUpsertInput = z.infer<typeof productUpsertSchema>;

export const productUpdateSchema = productUpsertSchema.partial();
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;