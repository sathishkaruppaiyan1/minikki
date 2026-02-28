-- Shared product cache table for cross-isolate caching
-- All Supabase Edge Function isolates read/write to this table
-- instead of each one hitting WooCommerce independently
CREATE TABLE IF NOT EXISTS product_cache (
  cache_key TEXT PRIMARY KEY,
  response_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_cache_cached_at ON product_cache (cached_at);

-- Enable RLS but allow service role full access
ALTER TABLE product_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON product_cache FOR ALL USING (true) WITH CHECK (true);
