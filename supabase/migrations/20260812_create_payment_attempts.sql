-- One row per *payment attempt* at the gateway (not per order).
-- A customer who fails on UPI and then succeeds on card produces two rows
-- sharing the same gateway_order_id: one 'failed', one 'captured'.
--
-- gateway_payment_id is UNIQUE so the webhook can upsert safely — Razorpay
-- retries a webhook up to 5 times and may deliver the same event twice.
-- RLS is on with no policies; only edge functions (service role) touch this.
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
  -- How this row was learned: webhook | client_verify | reconcile
  recorded_via TEXT NOT NULL DEFAULT 'webhook',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

-- Convenience view: the outcome of each gateway order across all its attempts.
-- `paid` is true if ANY attempt succeeded, no matter how many failed first.
--
-- security_invoker + explicit REVOKE: without both, a view in the public schema
-- runs as its owner and is exposed through PostgREST, which would hand anon
-- read access to payment data that RLS is deliberately hiding.
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
