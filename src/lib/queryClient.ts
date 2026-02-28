/**
 * React Query client with persistent cache
 * Data persists in localStorage for instant load on refresh/revisit
 */

import { QueryClient } from '@tanstack/react-query';
import { restoreQueryCache, persistQueryCache } from './queryPersister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Always stale - refetch in background for fresh stock/inventory data
      gcTime: 1000 * 60 * 5, // Keep in cache for 5 min (show cached while refetching)
      refetchOnWindowFocus: true, // Refetch when user returns for fresh data
      refetchOnMount: true, // Always refetch on mount for fresh stock
      refetchOnReconnect: true, // Refetch when internet reconnects
      retry: 1, // Retry once on failure
      retryDelay: 1000,
    },
  },
});

// Restore cache from localStorage on app start
if (typeof window !== 'undefined') {
  restoreQueryCache(queryClient);

  // Persist cache periodically and on mutations
  const queryCache = queryClient.getQueryCache();
  
  // Persist on query updates
  queryCache.subscribe((event) => {
    if (event?.type === 'updated' || event?.type === 'added') {
      // Debounce persistence to avoid too many writes
      setTimeout(() => persistQueryCache(queryClient), 1000);
    }
  });

  // Store reference for cache clearing
  (window as any).__REACT_QUERY_CLIENT__ = queryClient;

  // Persist before page unload
  window.addEventListener('beforeunload', () => {
    persistQueryCache(queryClient);
  });

  // Persist periodically (every 30 seconds)
  setInterval(() => {
    persistQueryCache(queryClient);
  }, 30000);
}
