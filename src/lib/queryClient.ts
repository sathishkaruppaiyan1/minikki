/**
 * React Query client with persistent cache
 * Data persists in localStorage for instant load on refresh/revisit
 */

import { QueryClient } from '@tanstack/react-query';
import { restoreQueryCache, persistQueryCache } from './queryPersister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Catalog data is stable between merchant edits, so the default is cached.
      // Freshness-sensitive queries (product detail, stock, orders) opt back in
      // individually - see useWooCommerce.ts. Previously these defaults were
      // staleTime 0 + all three refetch triggers on, which on mobile (app switch,
      // screen unlock, tower handoff) produced ~5.7 identical fetches per row per
      // visitor and 82% of all edge function invocations.
      staleTime: 1000 * 60 * 5, // 5 min
      gcTime: 1000 * 60 * 30, // Keep in cache 30 min (show cached while revalidating)
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
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
