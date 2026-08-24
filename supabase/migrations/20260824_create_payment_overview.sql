-- One row per checkout: what was initiated AND how it ended.
--
-- payment_initiation_logs alone only records that a payment was *started* —
-- its response_payload is the gateway order snapshot at creation time, so it
-- always reads amount_paid: 0. The outcome lives in payment_attempts. This view
-- joins the two so a single query answers "was this order actually paid, and if
-- not, why?".
--
-- LEFT JOIN on purpose: a checkout where the customer opened the modal and
-- walked away has no attempt row at all, and must still appear (as 'abandoned').
--
-- security_invoker + explicit REVOKE, same as payment_attempt_summary: without
-- both, a view in the public schema runs as its owner and is exposed through
-- PostgREST, handing anon read access to payment data RLS is hiding.
CREATE OR REPLACE VIEW public.payment_overview
WITH (security_invoker = true) AS
SELECT
  l.woocommerce_order_id,
  l.gateway_order_id,
  l.provider,
  l.created_at                            AS initiated_at,
  l.amount                                AS initiated_amount,
  l.currency,
  l.status                                AS initiation_status,
  l.error_message                         AS initiation_error,

  -- The single field to filter on. 'paid' means money was captured or
  -- authorised on at least one attempt, however many failed first.
  CASE
    WHEN l.status <> 'created'            THEN 'not_initiated'
    WHEN a.paid                           THEN 'paid'
    WHEN COALESCE(a.total_attempts, 0) > 0 THEN 'failed'
    ELSE 'abandoned'
  END                                     AS outcome,

  COALESCE(a.total_attempts, 0)           AS total_attempts,
  COALESCE(a.failed_attempts, 0)          AS failed_attempts,
  a.paid_amount,
  a.successful_payment_id,
  a.method,
  a.failure_code,
  a.failure_description,
  a.first_attempt_at,
  a.last_attempt_at,
  a.recorded_via
FROM public.payment_initiation_logs l
LEFT JOIN (
  SELECT
    gateway_order_id,
    COUNT(*)                                                          AS total_attempts,
    COUNT(*) FILTER (WHERE status = 'failed')                         AS failed_attempts,
    bool_or(status IN ('captured', 'authorized'))                     AS paid,
    MAX(amount) FILTER (WHERE status IN ('captured', 'authorized'))   AS paid_amount,
    (ARRAY_AGG(gateway_payment_id ORDER BY created_at DESC)
       FILTER (WHERE status IN ('captured', 'authorized')))[1]        AS successful_payment_id,
    -- Method/failure reason come from the most recent attempt of that kind.
    (ARRAY_AGG(method ORDER BY created_at DESC)
       FILTER (WHERE method IS NOT NULL))[1]                          AS method,
    (ARRAY_AGG(error_code ORDER BY created_at DESC)
       FILTER (WHERE status = 'failed'))[1]                           AS failure_code,
    (ARRAY_AGG(error_description ORDER BY created_at DESC)
       FILTER (WHERE status = 'failed'))[1]                           AS failure_description,
    (ARRAY_AGG(recorded_via ORDER BY created_at DESC))[1]             AS recorded_via,
    MIN(created_at)                                                   AS first_attempt_at,
    MAX(created_at)                                                   AS last_attempt_at
  FROM public.payment_attempts
  GROUP BY gateway_order_id
) a ON a.gateway_order_id = l.gateway_order_id;

REVOKE ALL ON public.payment_overview FROM anon, authenticated;

COMMENT ON VIEW public.payment_overview IS
  'One row per checkout: initiation details joined to the payment outcome. '
  'Filter on outcome = paid | failed | abandoned | not_initiated.';
