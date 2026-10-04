import { z } from 'zod';

/**
 * Zod schema for the paginated envelope every list endpoint returns:
 * { page, pageSize, total, totalPages, items: T[] }. Compose with any item
 * schema so `parseWithDates(paged(catalogProductSchema), data)` parses and
 * date-revives the whole page in one pass.
 */
export function paged<T extends z.ZodTypeAny>(item: T): z.ZodType<Pagedish<z.infer<T>>> {
  return z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
    items: z.array(item),
  });
}

interface Pagedish<T> {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: T[];
}