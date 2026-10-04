import { API_BASE } from '../api/client';

const MEDIA_BASE = API_BASE.replace(/\/api\/v1\/?$/, '');

/**
 * Convert a relative media path ("/media/...") to an absolute URL pointing
 * at the API host. Absolute URLs (http/https) pass through unchanged.
 */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${MEDIA_BASE}${path}`;
}
