-- Store every server-side payment gateway initiation attempt.
-- RLS is enabled with no anon policies; edge functions use service role.
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

ALTER TABLE public.payment_initiation_logs ENABLE ROW LEVEL SECURITY;
