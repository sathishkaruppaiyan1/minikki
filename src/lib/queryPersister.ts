/**
 * React Query persistence using localStorage
 * Persists query cache so data loads instantly on refresh/revisit
 */

const STORAGE_KEY = 'REACT_QUERY_CACHE';
const MAX_AGE = 1000 * 60 * 2; // 2 minutes - stock data must be fresh for accurate inventory

// Query keys that should NEVER be persisted to localStorage (stock-sensitive data)
const NON_PERSISTABLE_PREFIXES = [
  'woocommerce-products',
  'woocommerce-product',
  'woocommerce-product-id-fast',
  'woocommerce-product-gallery',
  'woocommerce-products-infinite',
  // Homepage config resolves to null when the WordPress plugin is unreachable.
  // Persisting that null would restore it as *fresh* on every load — and because
  // the cache timestamp is rewritten on each persist, it would never expire and
  // the app would stop asking WordPress entirely. Always fetch this one.
  'minikki-home-config',
];

/**
 * Homepage rows, keyed as [prefix, home_config.updated_at, ...]. These are
 * invalidated by the version in the key — WordPress bumps updated_at on every
 * Home Builder save — so MAX_AGE must not apply to them. Ageing them out on a
 * timer is exactly the per-visitor refetch this is meant to eliminate.
 */
const VERSION_PINNED_PREFIXES = ['home-products-by-ids', 'home-row-products'];

const isVersionPinned = (queryKey: unknown): boolean =>
  Array.isArray(queryKey) && VERSION_PINNED_PREFIXES.includes(String(queryKey[0]));

/**
 * Keep only the newest version of each pinned row and drop superseded ones, so
 * localStorage does not accumulate a full set of rows for every past edit.
 * updated_at is a unix timestamp, so the largest value is the current config.
 */
const pruneSupersededVersions = (queries: Record<string, unknown>): Record<string, unknown> => {
  let newest = -Infinity;
  for (const keyStr of Object.keys(queries)) {
    try {
      const key = JSON.parse(keyStr);
      if (!isVersionPinned(key)) continue;
      const version = Number(key[1]);
      if (Number.isFinite(version) && version > newest) newest = version;
    } catch {
      // Unparseable key; left for the caller to skip.
    }
  }
  if (newest === -Infinity) return queries;

  const kept: Record<string, unknown> = {};
  for (const [keyStr, value] of Object.entries(queries)) {
    try {
      const key = JSON.parse(keyStr);
      if (isVersionPinned(key)) {
        const version = Number(key[1]);
        if (Number.isFinite(version) && version !== newest) continue;
      }
      kept[keyStr] = value;
    } catch {
      // Skip unparseable entries entirely.
    }
  }
  return kept;
};

interface CacheData {
  queries: Record<string, any>;
  timestamp: number;
}

export const persistQueryCache = (queryClient: any) => {
  try {
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();
    
    const cacheData: CacheData = {
      queries: {},
      timestamp: Date.now(),
    };

    queries.forEach((query: any) => {
      const state = query.state;
      if (state.data !== undefined) {
        // Skip persisting stock-sensitive product queries
        const queryKeyStr = Array.isArray(query.queryKey) ? query.queryKey[0] : '';
        const shouldSkip = NON_PERSISTABLE_PREFIXES.some(prefix => queryKeyStr === prefix);
        if (shouldSkip) return;

        cacheData.queries[JSON.stringify(query.queryKey)] = {
          data: state.data,
          dataUpdatedAt: state.dataUpdatedAt,
          status: state.status,
        };
      }
    });

    cacheData.queries = pruneSupersededVersions(cacheData.queries);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (quotaError) {
      // Homepage rows carry full product objects and can be large. If we blow the
      // quota, drop the persisted cache rather than leaving a half-written blob.
      console.warn('Query cache too large to persist; clearing.', quotaError);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to persist query cache:', error);
  }
};

export const restoreQueryCache = (queryClient: any) => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return;

    const cacheData: CacheData = JSON.parse(cached);

    // MAX_AGE is applied per entry, not to the blob as a whole. The blob-level
    // timestamp is rewritten on every persist, so a global check expired data
    // based on when the tab was last open rather than when it was fetched — and
    // it discarded version-pinned rows that were still perfectly valid.
    const queries = pruneSupersededVersions(cacheData.queries);

    Object.entries(queries).forEach(([keyStr, value]: [string, any]) => {
      try {
        const queryKey = JSON.parse(keyStr);

        if (!isVersionPinned(queryKey)) {
          const fetchedAt = Number(value?.dataUpdatedAt);
          // Unknown age is treated as too old: better one refetch than serving
          // stock data of unknown vintage.
          if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > MAX_AGE) return;
        }

        queryClient.setQueryData(queryKey, value.data);
      } catch (e) {
        // Skip invalid query keys
      }
    });
  } catch (error) {
    console.warn('Failed to restore query cache:', error);
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const clearQueryCache = (queryClient?: any) => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Also clear React Query cache
    if (queryClient) {
      queryClient.clear();
    } else if (typeof window !== 'undefined' && (window as any).__REACT_QUERY_CLIENT__) {
      (window as any).__REACT_QUERY_CLIENT__.clear();
    }
  } catch (error) {
    console.warn('Failed to clear query cache:', error);
  }
};

// Expose clear function globally for debugging (run: window.clearAppCache() in console)
if (typeof window !== 'undefined') {
  (window as any).clearAppCache = () => clearQueryCache();
}
