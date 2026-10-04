import { z } from 'zod';

/** Trending row: score 0–10 plus a transparent breakdown so the UI can show the math. */
export const trendingProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  category: z.enum(['AUDIO', 'WEARABLES', 'SMART_HOME', 'MOBILE', 'COMPUTING', 'PHOTOGRAPHY']),
  brand: z.string(),
  priceMinor: z.number().int().nonnegative(),
  currency: z.string(),
  imageUrl: z.string(),
  averageRating: z.number().nullable(),
  reviewCount: z.number().int().nonnegative(),
  lastReviewedAt: z.date().nullable(),
  score: z.number(),
  scoreBreakdown: z.object({
    ratingComponent: z.number(),
    volumeComponent: z.number(),
    recencyComponent: z.number(),
    formula: z.string(),
  }),
});
export type TrendingProduct = z.infer<typeof trendingProductSchema>;

/** Homepage payload: featured products, top categories, and the trending shortlist. */
export const homeAggregatesSchema = z.object({
  featured: z.array(trendingProductSchema).max(4),
  categories: z.array(
    z.object({
      category: z.enum(['AUDIO', 'WEARABLES', 'SMART_HOME', 'MOBILE', 'COMPUTING', 'PHOTOGRAPHY']),
      count: z.number().int(),
      bestSeller: trendingProductSchema.nullable(),
    }),
  ),
  trending: z.array(trendingProductSchema).max(6),
});
export type HomeAggregates = z.infer<typeof homeAggregatesSchema>;