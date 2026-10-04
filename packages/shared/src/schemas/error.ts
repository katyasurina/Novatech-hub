/** Standard API error envelope. Every non-2xx response has this shape. */
export interface ApiError {
  code: string;
  message: string;
  /** Validation field errors: { field: message }. */
  fields?: Record<string, string>;
}

export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/** CRUD-type endpoints return created/updated/enriched DTOs directly on the 2xx body. */
export type ApiOk<T> = T;

export interface HealthStatus {
  ok: boolean;
  service: 'novatech-api';
  version: string;
  uptimeSeconds: number;
  db: 'up' | 'down';
  timestamp: string;
}