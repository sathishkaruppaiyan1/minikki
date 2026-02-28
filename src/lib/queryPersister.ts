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
];

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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to persist query cache:', error);
  }
};

export const restoreQueryCache = (queryClient: any) => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return;

    const cacheData: CacheData = JSON.parse(cached);
    
    // Check if cache is too old
    if (cacheData.timestamp && Date.now() - cacheData.timestamp > MAX_AGE) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Restore queries
    Object.entries(cacheData.queries).forEach(([keyStr, value]: [string, any]) => {
      try {
        const queryKey = JSON.parse(keyStr);
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
