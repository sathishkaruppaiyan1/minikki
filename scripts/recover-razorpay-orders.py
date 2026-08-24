#!/usr/bin/env python3
"""
Recover WooCommerce orders that were paid at Razorpay but left in "pending".

This is `razorpay-reconcile` as a standalone script, for when the edge function
cannot be deployed. Same semantics: Razorpay is asked what it actually captured,
and WooCommerce is repaired to match. Idempotent — safe to re-run.

  Supabase payment_initiation_logs  ->  gateway order ids
  Razorpay GET /v1/orders/{id}/payments  ->  was it captured?
  WooCommerce PUT /orders/{id}  ->  processing + set_paid

Dry-run by default. Nothing is written until you pass --apply.

Usage
-----
  export SUPABASE_URL="https://qksewiceckymrsvgxkfg.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
  export RAZORPAY_KEY_ID="rzp_live_..."
  export RAZORPAY_KEY_SECRET="..."
  export WOOCOMMERCE_STORE_URL="https://adminminikki.tech"
  export WOOCOMMERCE_CONSUMER_KEY="ck_..."
  export WOOCOMMERCE_CONSUMER_SECRET="cs_..."

  python3 recover-razorpay-orders.py --days 14            # report only
  python3 recover-razorpay-orders.py --days 14 --apply    # actually repair

Stdlib only — no pip install needed.
"""

import argparse
import base64
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

# Statuses we are willing to promote to "processing" on a confirmed payment.
# Mirrors RECOVERABLE_STATUSES in the edge functions. Never touch an order that
# is already processing/completed/refunded.
RECOVERABLE = {"pending", "on-hold", "failed", "cancelled"}

TIMEOUT = 30
RATE_LIMIT_SLEEP = 0.2  # be polite to the Razorpay API


class Fatal(Exception):
    pass


def load_env_file(path):
    """Read KEY=value lines from a config file into os.environ (no overwrite)."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def env(name, default=None, required=True):
    val = os.environ.get(name, default)
    if required and not val:
        raise Fatal(f"Missing required setting: {name}  (add it to recover.env)")
    return val


def http(method, url, headers=None, body=None, retries=3):
    """Minimal JSON HTTP with retry on 5xx / transient network errors."""
    data = json.dumps(body).encode() if body is not None else None
    headers = dict(headers or {})
    if data:
        headers.setdefault("Content-Type", "application/json")

    last_err = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                raw = resp.read().decode()
                parsed = json.loads(raw) if raw else None
                return resp.status, parsed, dict(resp.headers)
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            try:
                parsed = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                parsed = {"raw": raw}
            if 500 <= e.code < 600 and attempt < retries - 1:
                last_err = e
                time.sleep(1.5 * (attempt + 1))
                continue
            return e.code, parsed, dict(e.headers or {})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise Fatal(f"{method} {url} failed after {retries} attempts: {e}")
    raise Fatal(f"{method} {url} failed: {last_err}")


# --------------------------------------------------------------------------
# Sources
# --------------------------------------------------------------------------

def fetch_initiations(sb_url, srk, since_iso, page_size=200):
    """All successful Razorpay order creations since `since_iso`, newest first."""
    rows, offset = [], 0
    while True:
        qs = urllib.parse.urlencode({
            "select": "woocommerce_order_id,gateway_order_id,amount,created_at",
            "status": "eq.created",
            "provider": "eq.razorpay",
            "created_at": f"gte.{since_iso}",
            "order": "created_at.desc",
            "limit": page_size,
            "offset": offset,
        })
        status, body, _ = http("GET", f"{sb_url}/rest/v1/payment_initiation_logs?{qs}",
                               headers={"apikey": srk, "Authorization": f"Bearer {srk}"})
        if status != 200:
            raise Fatal(f"Supabase read failed ({status}): {body}")
        rows.extend(body)
        if len(body) < page_size:
            return rows
        offset += page_size


def razorpay_payments(rzp_auth, rzp_order_id):
    """Every attempt Razorpay recorded for this order — failures included."""
    status, body, _ = http(
        "GET", f"https://api.razorpay.com/v1/orders/{rzp_order_id}/payments",
        headers={"Authorization": f"Basic {rzp_auth}"})
    if status != 200:
        return None, f"razorpay {status}: {(body or {}).get('error', {}).get('description', body)}"
    return body.get("items", []), None


def woo_get_order(store, woo_auth, order_id):
    status, body, _ = http("GET", f"{store}/wp-json/wc/v3/orders/{order_id}",
                           headers={"Authorization": f"Basic {woo_auth}"})
    if status != 200:
        return None, f"woo GET {status}: {(body or {}).get('message', body)}"
    return body, None


def woo_mark_paid(store, woo_auth, order_id, payment_id, rzp_order_id, prev_status):
    payload = {
        "status": "processing",
        "set_paid": True,
        "transaction_id": payment_id,
        "meta_data": [
            {"key": "_razorpay_payment_id", "value": payment_id},
            {"key": "_razorpay_order_id", "value": rzp_order_id},
            {"key": "_payment_verified_via", "value": "recovery_script"},
            {"key": "_payment_recovered_from", "value": prev_status},
        ],
    }
    status, body, _ = http("PUT", f"{store}/wp-json/wc/v3/orders/{order_id}",
                           headers={"Authorization": f"Basic {woo_auth}"}, body=payload)
    if status not in (200, 201):
        return None, f"woo PUT {status}: {(body or {}).get('message', body)}"
    return body, None


def record_attempts(sb_url, srk, payments, woo_order_id):
    """Backfill payment_attempts so the trail exists for these recovered orders."""
    if not payments:
        return
    rows = [{
        "provider": "razorpay",
        "gateway_order_id": p.get("order_id"),
        "gateway_payment_id": p.get("id"),
        "woocommerce_order_id": int(woo_order_id) if woo_order_id else None,
        "status": p.get("status") or "unknown",
        "method": p.get("method"),
        "amount": (p["amount"] / 100) if isinstance(p.get("amount"), int) else None,
        "currency": p.get("currency") or "INR",
        "customer_email": p.get("email"),
        "customer_phone": p.get("contact"),
        "error_code": p.get("error_code"),
        "error_description": p.get("error_description"),
        "error_source": p.get("error_source"),
        "error_step": p.get("error_step"),
        "error_reason": p.get("error_reason"),
        "recorded_via": "recovery_script",
        "raw_payload": p,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    } for p in payments]

    status, body, _ = http(
        "POST",
        f"{sb_url}/rest/v1/payment_attempts?on_conflict=provider,gateway_payment_id",
        headers={
            "apikey": srk,
            "Authorization": f"Bearer {srk}",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        body=rows)
    if status not in (200, 201, 204):
        print(f"    ! could not record attempts: {status} {body}", file=sys.stderr)


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=14,
                    help="how far back to check (default 14)")
    ap.add_argument("--apply", action="store_true",
                    help="actually write to WooCommerce (default: dry run)")
    ap.add_argument("--order", type=int, action="append", dest="orders",
                    help="only this WooCommerce order id (repeatable)")
    ap.add_argument("--skip-amount-check", action="store_true",
                    help="repair even when the captured amount != order total")
    ap.add_argument("--csv", default="razorpay-recovery-report.csv",
                    help="where to write the report")
    ap.add_argument("--env-file", default=os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                       "recover.env"),
                    help="config file with the credentials (default: ./recover.env)")
    args = ap.parse_args()

    load_env_file(args.env_file)

    try:
        sb_url = env("SUPABASE_URL").rstrip("/")
        srk = env("SUPABASE_SERVICE_ROLE_KEY")
        rzp_auth = base64.b64encode(
            f'{env("RAZORPAY_KEY_ID")}:{env("RAZORPAY_KEY_SECRET")}'.encode()).decode()
        store = env("WOOCOMMERCE_STORE_URL").rstrip("/")
        woo_auth = base64.b64encode(
            f'{env("WOOCOMMERCE_CONSUMER_KEY")}:{env("WOOCOMMERCE_CONSUMER_SECRET")}'.encode()).decode()
    except Fatal as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    since = (datetime.now(timezone.utc) - timedelta(days=args.days)).isoformat()
    mode = "APPLY (writing to WooCommerce)" if args.apply else "DRY RUN (no writes)"
    print(f"\n  Mode:  {mode}")
    print(f"  Since: {since}\n")

    try:
        initiations = fetch_initiations(sb_url, srk, since)
    except Fatal as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    if args.orders:
        wanted = set(args.orders)
        initiations = [r for r in initiations if r.get("woocommerce_order_id") in wanted]

    print(f"  {len(initiations)} Razorpay order(s) to check\n")
    print(f"  {'WOO':>7}  {'WAS':<10} {'PAYMENT':<20} {'AMOUNT':>10}  RESULT")
    print(f"  {'-'*7}  {'-'*10} {'-'*20} {'-'*10}  {'-'*28}")

    report, counts = [], {}

    def tally(action):
        counts[action] = counts.get(action, 0) + 1

    for row in initiations:
        rzp_order_id = row.get("gateway_order_id")
        woo_id = row.get("woocommerce_order_id")
        if not rzp_order_id:
            continue

        time.sleep(RATE_LIMIT_SLEEP)
        payments, err = razorpay_payments(rzp_auth, rzp_order_id)
        if err:
            tally("api_error")
            print(f"  {str(woo_id):>7}  {'?':<10} {'-':<20} {'-':>10}  ERROR {err}")
            report.append({"woo_order_id": woo_id, "razorpay_order_id": rzp_order_id,
                           "action": "api_error", "detail": err})
            continue

        captured = next((p for p in payments if p.get("status") == "captured"), None)
        authorized = next((p for p in payments if p.get("status") == "authorized"), None)
        winner = captured or authorized

        if not winner:
            tally("unpaid")
            report.append({"woo_order_id": woo_id, "razorpay_order_id": rzp_order_id,
                           "action": "unpaid",
                           "detail": f"{len(payments)} attempt(s), none succeeded"})
            continue  # genuinely not paid — nothing to fix, keep output quiet

        pay_id = winner.get("id")
        paid_amt = winner.get("amount", 0) / 100

        if not woo_id:
            tally("unmapped")
            print(f"  {'?':>7}  {'?':<10} {pay_id:<20} {paid_amt:>10.2f}  UNMAPPED - investigate")
            report.append({"woo_order_id": "", "razorpay_order_id": rzp_order_id,
                           "payment_id": pay_id, "amount": paid_amt,
                           "action": "unmapped", "detail": "no WooCommerce order id"})
            continue

        order, err = woo_get_order(store, woo_auth, woo_id)
        if err:
            tally("api_error")
            print(f"  {woo_id:>7}  {'?':<10} {pay_id:<20} {paid_amt:>10.2f}  ERROR {err}")
            report.append({"woo_order_id": woo_id, "razorpay_order_id": rzp_order_id,
                           "payment_id": pay_id, "amount": paid_amt,
                           "action": "api_error", "detail": err})
            continue

        prev = order.get("status")
        if prev not in RECOVERABLE:
            tally("already_ok")
            report.append({"woo_order_id": woo_id, "razorpay_order_id": rzp_order_id,
                           "payment_id": pay_id, "amount": paid_amt,
                           "action": "already_ok", "detail": prev})
            continue  # already processing/completed — quiet

        # Safety: refuse to mark an order paid when the money doesn't match it.
        try:
            order_total = float(order.get("total") or 0)
        except (TypeError, ValueError):
            order_total = 0.0
        mismatch = abs(order_total - paid_amt) > 1.0
        if mismatch and not args.skip_amount_check:
            tally("amount_mismatch")
            print(f"  {woo_id:>7}  {prev:<10} {pay_id:<20} {paid_amt:>10.2f}  "
                  f"MISMATCH order total {order_total:.2f} - SKIPPED")
            report.append({"woo_order_id": woo_id, "razorpay_order_id": rzp_order_id,
                           "payment_id": pay_id, "amount": paid_amt,
                           "action": "amount_mismatch",
                           "detail": f"order total {order_total}"})
            continue

        note = " (authorized, not captured)" if not captured else ""
        if not args.apply:
            tally("would_recover")
            print(f"  {woo_id:>7}  {prev:<10} {pay_id:<20} {paid_amt:>10.2f}  "
                  f"WOULD RECOVER -> processing{note}")
            report.append({"woo_order_id": woo_id, "razorpay_order_id": rzp_order_id,
                           "payment_id": pay_id, "amount": paid_amt,
                           "action": "would_recover", "detail": f"from {prev}{note}"})
            continue

        updated, err = woo_mark_paid(store, woo_auth, woo_id, pay_id, rzp_order_id, prev)
        if err:
            tally("update_failed")
            print(f"  {woo_id:>7}  {prev:<10} {pay_id:<20} {paid_amt:>10.2f}  FAILED {err}")
            report.append({"woo_order_id": woo_id, "razorpay_order_id": rzp_order_id,
                           "payment_id": pay_id, "amount": paid_amt,
                           "action": "update_failed", "detail": err})
            continue

        record_attempts(sb_url, srk, payments, woo_id)
        tally("recovered")
        print(f"  {woo_id:>7}  {prev:<10} {pay_id:<20} {paid_amt:>10.2f}  "
              f"RECOVERED -> {updated.get('status')}{note}")
        report.append({"woo_order_id": woo_id, "razorpay_order_id": rzp_order_id,
                       "payment_id": pay_id, "amount": paid_amt,
                       "action": "recovered", "detail": f"from {prev}{note}"})

    # ---- summary ----
    print("\n  " + "=" * 60)
    labels = {
        "recovered": "Recovered (money found, order fixed)",
        "would_recover": "WOULD be recovered (re-run with --apply)",
        "already_ok": "Already processing/completed",
        "unpaid": "Genuinely unpaid (no successful attempt)",
        "amount_mismatch": "Amount mismatch - SKIPPED, check manually",
        "unmapped": "Paid but no WooCommerce order - INVESTIGATE",
        "update_failed": "WooCommerce rejected the update",
        "api_error": "API error",
    }
    for key, label in labels.items():
        if counts.get(key):
            print(f"  {counts[key]:>5}  {label}")

    money = sum(r.get("amount", 0) or 0 for r in report
                if r["action"] in ("recovered", "would_recover"))
    if money:
        verb = "Recovered" if args.apply else "Recoverable"
        print(f"\n  {verb}: Rs {money:,.2f}")

    if report:
        cols = ["woo_order_id", "razorpay_order_id", "payment_id", "amount", "action", "detail"]
        with open(args.csv, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            w.writerows(report)
        print(f"  Report: {args.csv}")

    if not args.apply and counts.get("would_recover"):
        print("\n  Nothing was changed. Re-run with --apply to repair these orders.")
    print()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(130)
