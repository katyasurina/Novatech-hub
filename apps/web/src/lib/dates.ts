import type { z } from 'zod';

/**
 * The API serialises Date fields as ISO-8601 strings; the shared Zod schemas
 * type them as `z.date()`. This reviver turns transport JSON back into Dates
 * before a schema parse, so one schema set works on both sides of the wire.
 *
 * Only strings that are full UTC datetimes ("2026-09-13T12:00:00.000Z") are
 * revived — date-only strings (spec values like "2024-06-01") are left alone.
 */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function revive(value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATETIME.test(value)) return new Date(value);
  if (Array.isArray(value)) return value.map(revive);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = revive(v);
    return out;
  }
  return value;
}

export function parseWithDates<T>(schema: z.ZodType<T>, payload: unknown): T {
  return schema.parse(revive(payload));
}