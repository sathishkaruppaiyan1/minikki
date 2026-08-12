# Razorpay + Supabase Setup Guide

Everything needed to take Razorpay from "no secrets configured" to a live,
retry-safe checkout — including the case where a customer's **first attempt
fails and their retry succeeds**.

Supabase project ref: `qksewiceckymrsvgxkfg` (taken from `VITE_SUPABASE_URL` —
`supabase/config.toml` previously named a different, empty project, so CLI
deploys from this repo were landing nowhere).

## Current state — probed 2026-08-12

| Check | Result | Action |
|---|---|---|
| `razorpay-webhook` deployed | yes | — |
| `razorpay-webhook` accepts unauthenticated POST | **no — 401 `UNAUTHORIZED_NO_AUTH_HEADER`** | **Razorpay webhooks are being rejected right now.** Redeploy after the `config.toml` fix (step 4) |
| `razorpay-reconcile` deployed | no (404) | Deploy it (step 4) |
| `woocommerce-taxes` deployed | no (404) | Deploy it — this is why GST does not show at checkout |
| `VITE_RAZORPAY_KEY_ID` in `.env` | missing | Step 3 |

Reproduce any of these with:
`curl -i -X POST https://qksewiceckymrsvgxkfg.supabase.co/functions/v1/razorpay-webhook`

---

## 0. How the pieces fit together

```
Browser (Checkout.tsx)
  │
  ├─1─> create-razorpay-order ──> Razorpay /v1/orders   → row in payment_initiation_logs
  │                                                        (receipt = "order_<wooId>")
  ├─2─> Razorpay Checkout modal
  │       ├── attempt #1 fails  → payment.failed  ─┐
  │       └── attempt #2 works  → handler fires    │
  │                                                │
  ├─3─> verify-razorpay-payment ──> HMAC check ────┤──> row in payment_attempts
  │        └─> WooCommerce: processing + paid      │      (one row per attempt)
  │                                                │
Razorpay servers                                   │
  └─4─> razorpay-webhook (safety net) ─────────────┘
           └─> WooCommerce: processing + paid, even if the order was
               already marked "failed" by the earlier attempt

Cron / manual
  └─5─> razorpay-reconcile ──> Razorpay /v1/orders/{id}/payments
           └─> pulls EVERY attempt and repairs any order left in the wrong state
```

Three independent paths (browser, webhook, reconcile) can settle an order. All
three are idempotent, so it does not matter which one wins.

---

## 1. Get your Razorpay credentials

1. Log in to <https://dashboard.razorpay.com>.
2. Toggle **Test Mode** (top bar) while you are setting this up. Repeat the whole
   guide with Live Mode keys before going live — test and live keys are separate.
3. **Account & Settings → API Keys → Generate Test Key**.
4. Copy both values now — the secret is shown **once**:
   - `Key ID` → looks like `rzp_test_xxxxxxxxxxxx` (public, safe in the browser)
   - `Key Secret` → **server-only, never put this in a `VITE_` variable**

You will generate the third value (the webhook secret) yourself in step 5.

---

## 2. Set the Supabase Edge Function secrets

These are read by `create-razorpay-order`, `verify-razorpay-payment`,
`razorpay-webhook`, and `razorpay-reconcile`.

| Secret | Value | Used by |
|---|---|---|
| `RAZORPAY_KEY_ID` | `rzp_test_…` / `rzp_live_…` | order creation, webhook, reconcile |
| `RAZORPAY_KEY_SECRET` | from step 1 | order creation, signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | you invent it in step 5 | webhook signature check |
| `WOOCOMMERCE_STORE_URL` | `https://your-store.com` (no trailing slash) | all order updates |
| `WOOCOMMERCE_CONSUMER_KEY` | `ck_…` | all order updates |
| `WOOCOMMERCE_CONSUMER_SECRET` | `cs_…` | all order updates |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
platform — do **not** add them yourself (Supabase rejects secrets starting with
`SUPABASE_`).

### Option A — Dashboard

**Project Settings → Edge Functions → Secrets → Add new secret**, one per row above.

### Option B — CLI (recommended, repeatable)

```bash
supabase login
supabase link --project-ref qksewiceckymrsvgxkfg

supabase secrets set \
  RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx" \
  RAZORPAY_KEY_SECRET="your_key_secret" \
  RAZORPAY_WEBHOOK_SECRET="a_long_random_string_you_generate" \
  WOOCOMMERCE_STORE_URL="https://your-store.com" \
  WOOCOMMERCE_CONSUMER_KEY="ck_xxxxxxxx" \
  WOOCOMMERCE_CONSUMER_SECRET="cs_xxxxxxxx"

# Confirm (shows names + hashes, never the values)
supabase secrets list
```

Secrets apply to functions **deployed after** the secret is set, so redeploy
(step 4) if you change one later.

---

## 3. Add the browser-side key

`Checkout.tsx` reads `import.meta.env.VITE_RAZORPAY_KEY_ID`. **Your `.env` is
currently missing it**, which means the Razorpay modal opens with an undefined
key and fails immediately. Add it:

```bash
# .env  (local dev)
VITE_RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx"
```

Then add the same variable to your hosting provider (Vercel → Project →
Settings → Environment Variables) for Preview and Production, and redeploy.
`VITE_` variables are baked into the JS bundle at build time — a new value needs
a new build.

> Only the **Key ID** goes here. If the Key *Secret* ever appears in a `VITE_`
> variable, rotate it immediately in the Razorpay dashboard.

---

## 4. Apply the database migrations and deploy the functions

```bash
# Two tables: payment_initiation_logs (order creation) and payment_attempts (per attempt)
supabase db push

# Deploy the four Razorpay functions
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy razorpay-webhook
supabase functions deploy razorpay-reconcile
```

`supabase/config.toml` sets `verify_jwt = false` for all four. This is
**mandatory** for `razorpay-webhook` — Razorpay cannot send a Supabase token, so
with JWT verification on, every webhook would be rejected with 401 before your
code runs. Each function authenticates its own callers instead:

- `razorpay-webhook` → `x-razorpay-signature` HMAC
- `verify-razorpay-payment` → Razorpay payment signature HMAC
- `razorpay-reconcile` → `Bearer <service role key>`, checked in constant time

If you deploy by pasting into the dashboard instead of using the CLI, set
**"Verify JWT with legacy secret" = off** on the `razorpay-webhook` function.

Verify the deploy:

```bash
curl -i -X POST https://qksewiceckymrsvgxkfg.supabase.co/functions/v1/razorpay-webhook
# Expect: 400 "Missing signature"   ← good, the function ran
# If you get 401 Unauthorized       ← verify_jwt is still on
```

---

## 5. Create the webhook in Razorpay

1. **Dashboard → Account & Settings → Webhooks → Add New Webhook**.
2. **Webhook URL**:
   ```
   https://qksewiceckymrsvgxkfg.supabase.co/functions/v1/razorpay-webhook
   ```
   (If you serve functions from the custom domain `dashboard.blacklovers.in`,
   use `https://dashboard.blacklovers.in/functions/v1/razorpay-webhook`.)
3. **Secret**: paste the exact same string you set as `RAZORPAY_WEBHOOK_SECRET`.
   Generate one with `openssl rand -hex 32` if you have not already. A mismatch
   here is the #1 cause of "webhook fires but nothing happens".
4. **Active Events** — tick all four:
   - `payment.captured` — the money is settled → order becomes *processing*
   - `payment.authorized` — authorised but not yet captured
   - `payment.failed` — **required for the retry story**; this is what records
     the failed first attempt
   - `order.paid` — belt-and-braces confirmation at the order level
5. **Alert Email**: an address you actually read. Razorpay emails you when the
   endpoint starts failing.
6. Save. Razorpay retries a failed delivery up to 5 times with backoff, so a
   brief outage is not lost data.

Add the webhook **separately in Live Mode** — webhook config does not carry over
from Test Mode.

---

## 6. Test it

### 6a. Happy path

Place a test order and pay with card `4111 1111 1111 1111`, any future expiry,
any CVV, OTP `1234` (Razorpay's standard test card — the current list is under
**Dashboard → Test Details**).

Confirm all four:

```sql
-- 1. The order was created at the gateway
select * from payment_initiation_logs order by created_at desc limit 5;

-- 2. The attempt was recorded
select gateway_payment_id, status, method, amount, recorded_via
from payment_attempts order by created_at desc limit 5;
```

3. WooCommerce order is **processing** with a `_razorpay_payment_id` meta field.
4. `supabase functions logs razorpay-webhook` shows `Webhook received: payment.captured`.

### 6b. The failure-then-retry path — the one that matters

1. Start a checkout and choose **UPI**, entering the test VPA `failure@razorpay`.
   The attempt is declined.
2. Without closing the modal, retry with `success@razorpay` (or the test card).
3. Expected result:

```sql
select gateway_order_id, gateway_payment_id, status, error_description, recorded_via
from payment_attempts
where gateway_order_id = 'order_XXXXXXXXXXX'
order by created_at;
```

| gateway_payment_id | status | error_description | recorded_via |
|---|---|---|---|
| pay_aaa… | failed | Payment processing failed… | webhook |
| pay_bbb… | captured | *null* | client_verify |

And the WooCommerce order is **processing**, not failed.

The summary view collapses this to one row per gateway order:

```sql
select * from payment_attempt_summary
where paid = true and failed_attempts > 0
order by last_attempt_at desc;
```

### 6c. Simulate a dropped browser

Pay successfully, then kill the tab before the "Payment Successful" toast. The
`verify-razorpay-payment` call never completes — the webhook settles the order
a few seconds later. Check `_payment_verified_via = webhook` on the order meta.

---

## 7. How the retry case is handled (what changed and why)

The original flow had a gap that silently lost paid orders:

| Step | Old behaviour | Problem |
|---|---|---|
| Attempt 1 declines | Browser immediately PUT the WooCommerce order to `failed` | Races with the retry that follows seconds later |
| Attempt 2 succeeds | Webhook only promoted orders in `pending`/`on-hold` | Order was already `failed` → webhook **skipped it** → customer paid, order stayed failed |
| Failed attempts | Never stored anywhere | No way to see how often customers fail before succeeding |

What it does now:

1. **The browser no longer writes on the first decline.** `payment.failed` only
   records the reason locally and shows a toast; Razorpay keeps the modal open
   for a retry. The order is written to `failed`/`cancelled` only in `ondismiss`,
   i.e. once the customer actually gives up — and never at all if a payment
   succeeded (`paymentSucceeded` guard).
2. **`failed` and `cancelled` are recoverable.** Both `razorpay-webhook` and
   `verify-razorpay-payment` promote an order to *processing* from
   `pending`, `on-hold`, `failed`, **or** `cancelled`, and never touch
   `processing`, `completed`, or `refunded`. Recovered orders get
   `_payment_recovered_from` meta so they are easy to audit.
3. **Every attempt is persisted.** `payment_attempts` has a unique constraint on
   `(provider, gateway_payment_id)` and all writes are upserts, so Razorpay's
   duplicate deliveries and the authorized→captured progression collapse into
   one row instead of creating duplicates.
4. **`razorpay-reconcile` is the final backstop.** It calls
   `GET /v1/orders/{id}/payments`, which returns **every** attempt Razorpay
   recorded — failures included — and repairs any order whose status disagrees
   with the money.

> **Stock note:** cancelling an order restores stock in WooCommerce, and moving
> it back to *processing* reduces it again. A recovery from `cancelled` logs a
> `verify stock levels` warning. If your catalogue is tight on inventory, spot
> check recovered orders.

---

## 8. Reconciliation (fetching all payment attempts)

Never call this from the browser — it authenticates with the service role key.

```bash
SB=https://qksewiceckymrsvgxkfg.supabase.co
SRK="<service role key>"   # Project Settings → API → service_role

# One WooCommerce order
curl -X POST "$SB/functions/v1/razorpay-reconcile" \
  -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  -d '{"woocommerce_order_id": 1234}'

# One gateway order
curl -X POST "$SB/functions/v1/razorpay-reconcile" \
  -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  -d '{"razorpay_order_id": "order_XyZ123"}'

# Sweep everything initiated in the last 24 hours (max 100 orders)
curl -X POST "$SB/functions/v1/razorpay-reconcile" \
  -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  -d '{"sweep": true, "hours": 24}'
```

Response:

```json
{
  "checked": 12,
  "recovered": 1,
  "results": [
    {
      "razorpay_order_id": "order_XyZ123",
      "woocommerce_order_id": 1234,
      "attempts": 2,
      "failed_attempts": 1,
      "successful_payment_id": "pay_bbb",
      "action": "recovered",
      "previous_status": "failed"
    }
  ]
}
```

`action` values: `recovered` (order fixed), `already_paid` (nothing to do),
`no_successful_payment` (genuinely unpaid), `no_payments` (customer never tried),
`unmapped` (could not resolve the WooCommerce order — investigate manually),
`update_failed` (WooCommerce rejected the write).

### Run the sweep hourly

In the SQL editor, once:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the key in Vault rather than inlining it in the job definition
select vault.create_secret('<service role key>', 'razorpay_reconcile_key');

select cron.schedule(
  'razorpay-hourly-reconcile',
  '17 * * * *',
  $$
  select net.http_post(
    url     := 'https://qksewiceckymrsvgxkfg.supabase.co/functions/v1/razorpay-reconcile',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret
                                                from vault.decrypted_secrets
                                                where name = 'razorpay_reconcile_key')
               ),
    body    := '{"sweep": true, "hours": 6}'::jsonb
  );
  $$
);
```

Check it with `select * from cron.job_run_details order by start_time desc limit 10;`

---

## 9. Useful queries

```sql
-- Orders that were paid only after one or more failures (last 7 days)
select * from payment_attempt_summary
where paid and failed_attempts > 0
  and last_attempt_at > now() - interval '7 days'
order by last_attempt_at desc;

-- Why are customers failing? Ranked decline reasons
select error_code, error_description, method, count(*)
from payment_attempts
where status = 'failed' and created_at > now() - interval '30 days'
group by 1, 2, 3 order by count(*) desc;

-- Initiations that never produced any attempt (customer bailed at the modal)
select l.woocommerce_order_id, l.gateway_order_id, l.amount, l.created_at
from payment_initiation_logs l
left join payment_attempts a on a.gateway_order_id = l.gateway_order_id
where l.provider = 'razorpay' and l.status = 'created' and a.id is null
  and l.created_at > now() - interval '7 days'
order by l.created_at desc;

-- Success rate by payment method
select method,
       count(*) filter (where status in ('captured','authorized')) as succeeded,
       count(*) filter (where status = 'failed')                   as failed,
       round(100.0 * count(*) filter (where status in ('captured','authorized'))
             / nullif(count(*), 0), 1)                             as success_pct
from payment_attempts
where created_at > now() - interval '30 days'
group by method order by succeeded desc;
```

Both tables have RLS enabled with **no policies**, so they are invisible to the
anon key and readable only via the service role (SQL editor, edge functions).

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Modal never opens, console shows an invalid key | `VITE_RAZORPAY_KEY_ID` missing or not rebuilt | Step 3, then redeploy the frontend |
| `Razorpay credentials not configured in Supabase secrets.` | `RAZORPAY_KEY_ID`/`_SECRET` unset | Step 2, then redeploy the functions |
| Webhook shows 401 in the Razorpay dashboard | `verify_jwt` still on | `verify_jwt = false` in `config.toml`, redeploy |
| Webhook shows 400 "Invalid signature" | Dashboard secret ≠ `RAZORPAY_WEBHOOK_SECRET` | Re-enter both sides; no stray whitespace |
| Webhook 500 "Webhook secret not configured" | Secret set after the last deploy | `supabase functions deploy razorpay-webhook` |
| Payment succeeds, order stays *pending* | WooCommerce credentials wrong, or the store blocks the REST call | Check `supabase functions logs razorpay-webhook`; test the WC key with a manual `GET /wp-json/wc/v3/orders/<id>` |
| Order stuck *failed* although money was taken | Webhook missed | `razorpay-reconcile` with that order id; then check why the webhook did not arrive |
| Money debited, no order at all | Razorpay order created but WooCommerce order lost | Look up the receipt in `payment_initiation_logs`; refund from the Razorpay dashboard if there is no matching order |
| Duplicate rows in `payment_attempts` | Migration applied without the unique constraint | Re-run `20260812_create_payment_attempts.sql` |

Live function logs: `supabase functions logs razorpay-webhook --tail`
Razorpay delivery log: **Dashboard → Webhooks → your endpoint → Recent Deliveries**
(shows the exact request body and your response code — the fastest way to debug).

---

## 11. Going live

- [ ] Generate **Live Mode** API keys; update `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- [ ] Update `VITE_RAZORPAY_KEY_ID` to `rzp_live_…` in the host env, then rebuild
- [ ] Create the webhook again in **Live Mode** (config does not carry over)
- [ ] Redeploy all four functions so they pick up the new secrets
- [ ] Place one real low-value order end to end, then refund it
- [ ] Confirm the hourly reconcile cron is running
- [ ] Set a calendar reminder to rotate `RAZORPAY_WEBHOOK_SECRET` periodically
