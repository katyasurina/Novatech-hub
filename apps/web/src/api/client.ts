import type { ApiError } from '@novatech/shared';
import { useAuthStore } from '../stores/auth';

/**
 * Typed fetch client for /api/v1.
 * - Sends the in-memory access token as a Bearer header.
 * - Reads/writes the refresh cookie with credentials:'include'.
 * - On a 401 with a session present, performs ONE single-flight refresh then
 *   retries the original request. Rotation is global so concurrent 401s don't
 *   stampede the refresh endpoint.
 * - Non-2xx bodies follow the shared envelope: { error: { code, message, fields? } }.
 */

const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api/v1').replace(/\/+$/, '');

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON body — stringified here and sent as application/json. */
  body?: unknown;
  /** multipart/form-data body; mutually exclusive with `body`. */
  form?: FormData;
  /** Attach the Bearer token (default true). */
  auth?: boolean;
  /** Allow a single refresh-retry on 401 (default true). */
  retryOnUnauthorized?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

async function rotateRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; user: never };
      useAuthStore.getState().setSession(data.user, data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    form,
    auth = true,
    retryOnUnauthorized = true,
  } = options;

  const headers: Record<string, string> = {};
  if (form) {
    // Let the browser set the multipart boundary; no Content-Type header.
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = auth ? useAuthStore.getState().accessToken : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const request = (withTokenRefresh: boolean) =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
      .then(async (res) => {
        if (res.status === 204) return undefined as T;
        const payload: unknown = await res.json().catch(() => null);
        if (!res.ok) throw parseError(res.status, payload);
        return payload as T;
      })
      .catch((err: unknown) => {
        // Retry exactly once after a successful rotation.
        if (
          err instanceof ApiClientError &&
          err.status === 401 &&
          withTokenRefresh &&
          retryOnUnauthorized &&
          (token || auth)
        ) {
          return rotateRefreshToken().then((rotated) => {
            if (!rotated) {
              useAuthStore.getState().clearSession();
              throw err;
            }
            return apiFetch<T>(path, { ...options, retryOnUnauthorized: false });
          });
        }
        throw err;
      });

  return request(true);
}

function parseError(status: number, payload: unknown): ApiClientError {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const err = (payload as { error: ApiError }).error;
    return new ApiClientError(status, err.code, err.message, err.fields);
  }
  return new ApiClientError(status, 'INTERNAL', `Request failed with status ${status}`);
}

export { API_BASE };