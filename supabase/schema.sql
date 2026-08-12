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

-- Payment initiation logs (server-side audit trail for gateway order creation)

CREATE TABLE IF NOT EXISTS public.payment_initiation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  woocommerce_order_id BIGINT,
  gateway_order_id TEXT,
  amount NUMERIC(12, 2),
  currency TEXT DEFAULT 'INR',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_initiation_logs_provider
  ON public.payment_initiation_logs(provider);
CREATE INDEX IF NOT EXISTS idx_payment_initiation_logs_woocommerce_order_id
  ON public.payment_initiation_logs(woocommerce_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_initiation_logs_created_at
  ON public.payment_initiation_logs(created_at DESC);

-- RLS on, NO policies: only the service role (edge functions) can write/read logs.
ALTER TABLE public.payment_initiation_logs ENABLE ROW LEVEL SECURITY;

-- Payment attempts (one row per attempt at the gateway, failures included).
-- A customer who fails on UPI then succeeds on card leaves two rows sharing
-- the same gateway_order_id.

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  gateway_order_id TEXT,
  gateway_payment_id TEXT NOT NULL,
  woocommerce_order_id BIGINT,
  status TEXT NOT NULL,            -- created | authorized | captured | failed | refunded
  method TEXT,                     -- upi | card | netbanking | wallet ...
  amount NUMERIC(12, 2),
  currency TEXT DEFAULT 'INR',
  customer_email TEXT,
  customer_phone TEXT,
  error_code TEXT,
  error_description TEXT,
  error_source TEXT,
  error_step TEXT,
  error_reason TEXT,
  recorded_via TEXT NOT NULL DEFAULT 'webhook',  -- webhook | client_verify | reconcile
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Idempotency key: Razorpay retries a webhook up to 5 times.
  CONSTRAINT payment_attempts_provider_payment_id_key
    UNIQUE (provider, gateway_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_gateway_order_id
  ON public.payment_attempts(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_woocommerce_order_id
  ON public.payment_attempts(woocommerce_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status
  ON public.payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created_at
  ON public.payment_attempts(created_at DESC);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- `paid` is true if ANY attempt succeeded, no matter how many failed first.
-- security_invoker + REVOKE keep this out of reach of the anon key: a plain
-- view in the public schema runs as its owner and would bypass the RLS above.
CREATE OR REPLACE VIEW public.payment_attempt_summary
WITH (security_invoker = true) AS
SELECT
  gateway_order_id,
  MAX(woocommerce_order_id)                                        AS woocommerce_order_id,
  COUNT(*)                                                         AS total_attempts,
  COUNT(*) FILTER (WHERE status = 'failed')                        AS failed_attempts,
  bool_or(status IN ('captured', 'authorized'))                    AS paid,
  MAX(amount) FILTER (WHERE status IN ('captured', 'authorized'))  AS paid_amount,
  (ARRAY_AGG(gateway_payment_id ORDER BY created_at DESC)
     FILTER (WHERE status IN ('captured', 'authorized')))[1]       AS successful_payment_id,
  MIN(created_at)                                                  AS first_attempt_at,
  MAX(created_at)                                                  AS last_attempt_at
FROM public.payment_attempts
GROUP BY gateway_order_id;

REVOKE ALL ON public.payment_attempt_summary FROM anon, authenticated;
