import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser } from '@novatech/shared';

/**
 * Auth session. The access token lives in memory (never localStorage) and is
 * sent as a Bearer header by the API client; the refresh token is an httpOnly
 * cookie owned by the API. On reload we restore via /auth/refresh (see
 * useSession) rather than trusting a stored token.
 *
 * `persist` keeps only the `user` object across reloads so the shell can render
 * instantly; the token itself is intentionally not persisted.
 */
interface AuthState {
  user: PublicUser | null;
  /** Access token, held ONLY in memory for the API client. */
  accessToken: string | null;
  /** True after the one-time /auth/refresh attempt on app load. */
  ready: boolean;
  setSession: (user: PublicUser, accessToken: string) => void;
  touchAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  markReady: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      ready: false,
      setSession: (user, accessToken) => set({ user, accessToken, ready: true }),
      touchAccessToken: (accessToken) => set({ accessToken }),
      clearSession: () => set({ user: null, accessToken: null, ready: true }),
      markReady: () => set({ ready: true }),
    }),
    {
      name: 'novatech-auth',
      partialize: (s): Pick<AuthState, 'user'> => ({ user: s.user }),
    },
  ),
);