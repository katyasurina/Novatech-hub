import { QueryClient } from '@tanstack/react-query';

/**
 * One QueryClient for the whole app.
 * - `staleTime`: aggregates (home, trending, summaries) are refetched in the
 *   background on mount but never block a page change with a cache throbber.
 * - `retry`: mutations never auto-retry; queries retry only transient failures.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if ((error as { status?: number })?.status === 401) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});