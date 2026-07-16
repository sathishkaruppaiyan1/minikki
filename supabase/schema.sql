-- ============================================================
-- Minikki — consolidated schema for a fresh Supabase project
-- Run this once in the new project's SQL Editor.
--
-- Security model: all tables have RLS ENABLED with no anon
-- policies (except public read of review media). Edge functions
-- use the service-role key, which bypasses RLS. The public anon
-- key can read/write NOTHING except viewing review media.
-- ============================================================

-- ─── OTP login (WhatsApp via Interakt) ───────────────────────

CREATE TABLE IF NOT EXISTS public.otps (
  id BIGSERIAL PRIMARY KEY,
  phone_key VARCHAR(25) UNIQUE,            -- "+919876543210" (country code + phone)
  phone_number VARCHAR(20) UNIQUE NOT NULL, -- 10-digit phone (upsert conflict target)
  otp VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_otps_phone_key ON public.otps(phone_key);
CREATE INDEX IF NOT EXISTS idx_otps_phone_number ON public.otps(phone_number);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON public.otps(expires_at);

-- RLS on, NO policies: only the service role (edge functions) can touch OTPs.
-- (The old schema allowed anon reads here — that let anyone steal OTPs.)
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

-- ─── Users (created on successful OTP verification) ──────────

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone_number ON public.users(phone_number);

-- RLS on, NO policies: service-role only. Anon key cannot enumerate customers.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ─── Review media (images/videos attached to product reviews) ─

CREATE TABLE IF NOT EXISTS public.review_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  reviewer_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_media_review_id ON public.review_media(review_id);
CREATE INDEX IF NOT EXISTS idx_review_media_product_id ON public.review_media(product_id);

ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;

-- Reviews are public content: anyone may read. Writes: service role only.
CREATE POLICY "Anyone can view review media"
  ON public.review_media FOR SELECT
  USING (true);

-- ─── Product cache (edge-function shared cache) ──────────────

CREATE TABLE IF NOT EXISTS public.product_cache (
  cache_key TEXT PRIMARY KEY,
  response_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_cache_cached_at ON public.product_cache(cached_at);

-- RLS on, NO policies: service-role only (anon writes could poison product data).
ALTER TABLE public.product_cache ENABLE ROW LEVEL SECURITY;

-- ─── Storage: review media bucket ─────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('review-media', 'review-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read; uploads happen through edge functions (service role bypasses RLS).
CREATE POLICY "Public read access for review media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-media');
