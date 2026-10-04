import { useEffect } from 'react';
import { apiFetch } from '../api/client';
import { useAuthStore } from '../stores/auth';

/**
 * One-time session restore on app mount.
 *
 * The access token lives in memory only, so after a hard reload there is no
 * token — but the httpOnly refresh cookie still exists. Calling /auth/refresh
 * rotates it and rehydrates the Zustand session. A clean failure just leaves
 * the app anonymous (the header shows "Sign in"); ready flips true either way
 * so route guards never block on a hang.
 */
export function useSession(): void {
  useEffect(() => {
    const state = useAuthStore.getState();
    if (state.accessToken) {
      state.markReady();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ accessToken: string; user: import('@novatech/shared').PublicUser }>(
          '/auth/refresh',
          { method: 'POST', auth: false, retryOnUnauthorized: false },
        );
        if (!cancelled) useAuthStore.getState().setSession(data.user, data.accessToken);
      } catch {
        if (!cancelled) useAuthStore.getState().clearSession();
      } finally {
        if (!cancelled) useAuthStore.getState().markReady();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}