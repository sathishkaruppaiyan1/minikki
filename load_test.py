"""
Load Test Script for Pixel Perfect Shop - Supabase Edge Functions
Tests concurrent user handling with smart tiered caching.

Phases:
  1. Discovery  — fetch listing to find a valid product ID
  2. Warmup     — prime all endpoint caches (1 request each)
  3. Cache Test — burst requests to verify cache hits are fast
  4. Load Test  — escalating concurrency scenarios

Usage:
    pip install aiohttp
    python load_test.py
"""

import asyncio
import aiohttp
import json
import time
import statistics
import sys
from dataclasses import dataclass, field

# ── Configuration ──────────────────────────────────────────────────────────────

SUPABASE_URL = "https://dashboard.blacklovers.in"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyc2lwdnFqcHV1ZXNid295Z3NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NDA2ODgsImV4cCI6MjA4NDIxNjY4OH0.PQEGYLcbyRssfkLO1dqmngNsBO284kVSWEbNNgCP5ho"

BASE_URL = f"{SUPABASE_URL}/functions/v1/woocommerce-products"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

TIMEOUT_SECONDS = 30

# Scenarios: (label, concurrent_users, requests_per_user)
SCENARIOS = [
    ("Light Load",     5,  2),
    ("Medium Load",   20,  2),
    ("Heavy Load",    50,  2),
    ("Spike Load",   100,  1),
    ("Extreme Load", 200,  1),
]


# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class RequestResult:
    endpoint: str
    status: int
    latency_ms: float
    success: bool
    error: str = ""
    size_bytes: int = 0


@dataclass
class ScenarioReport:
    label: str
    concurrent: int
    total_requests: int
    elapsed_s: float = 0
    results: list = field(default_factory=list)

    @property
    def successes(self):
        return [r for r in self.results if r.success]

    @property
    def failures(self):
        return [r for r in self.results if not r.success]

    @property
    def success_rate(self):
        return (len(self.successes) / len(self.results) * 100) if self.results else 0

    @property
    def latencies(self):
        return [r.latency_ms for r in self.successes]

    @property
    def rps(self):
        return len(self.successes) / self.elapsed_s if self.elapsed_s > 0 else 0

    def summary(self):
        lats = self.latencies
        if not lats:
            return {"p50": 0, "p95": 0, "p99": 0, "avg": 0, "min": 0, "max": 0}
        lats_sorted = sorted(lats)
        n = len(lats_sorted)
        return {
            "avg": statistics.mean(lats_sorted),
            "min": lats_sorted[0],
            "max": lats_sorted[-1],
            "p50": lats_sorted[int(n * 0.50)],
            "p95": lats_sorted[min(int(n * 0.95), n - 1)],
            "p99": lats_sorted[min(int(n * 0.99), n - 1)],
        }


# ── Core ───────────────────────────────────────────────────────────────────────

async def make_request(session: aiohttp.ClientSession, endpoint_name: str, url: str) -> RequestResult:
    start = time.perf_counter()
    try:
        async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=TIMEOUT_SECONDS)) as resp:
            body = await resp.read()
            latency = (time.perf_counter() - start) * 1000
            success = resp.status == 200
            return RequestResult(
                endpoint=endpoint_name,
                status=resp.status,
                latency_ms=round(latency, 1),
                success=success,
                size_bytes=len(body),
                error="" if success else f"HTTP {resp.status}",
            )
    except asyncio.TimeoutError:
        latency = (time.perf_counter() - start) * 1000
        return RequestResult(endpoint=endpoint_name, status=0, latency_ms=round(latency, 1), success=False, error="Timeout")
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return RequestResult(endpoint=endpoint_name, status=0, latency_ms=round(latency, 1), success=False, error=str(e)[:80])


async def run_scenario(label: str, concurrent: int, requests_per_user: int, endpoints: dict) -> ScenarioReport:
    total = concurrent * requests_per_user
    report = ScenarioReport(label=label, concurrent=concurrent, total_requests=total)

    endpoint_items = list(endpoints.items())
    tasks_spec = []
    for user_idx in range(concurrent):
        for req_idx in range(requests_per_user):
            ep_name, ep_url = endpoint_items[(user_idx + req_idx) % len(endpoint_items)]
            tasks_spec.append((ep_name, ep_url))

    connector = aiohttp.TCPConnector(limit=min(concurrent * 2, 300), limit_per_host=min(concurrent * 2, 300))
    async with aiohttp.ClientSession(connector=connector) as session:
        start = time.perf_counter()
        tasks = [make_request(session, name, url) for name, url in tasks_spec]
        report.results = await asyncio.gather(*tasks)
        report.elapsed_s = time.perf_counter() - start

    return report


# ── Reporting ──────────────────────────────────────────────────────────────────

def print_header(text: str):
    width = 72
    print(f"\n{'=' * width}")
    print(f"  {text}")
    print(f"{'=' * width}")


def print_scenario_report(report: ScenarioReport):
    s = report.summary()
    print(f"\n--- {report.label} ({report.concurrent} concurrent users) ---")
    print(f"  Total Requests : {report.total_requests}")
    print(f"  Successful     : {len(report.successes)}")
    print(f"  Failed         : {len(report.failures)}")
    print(f"  Success Rate   : {report.success_rate:.1f}%")
    print(f"  Throughput     : {report.rps:.1f} req/s")
    print(f"  Avg Latency    : {s['avg']:.0f} ms")
    print(f"  Min Latency    : {s['min']:.0f} ms")
    print(f"  P50 Latency    : {s['p50']:.0f} ms")
    print(f"  P95 Latency    : {s['p95']:.0f} ms")
    print(f"  P99 Latency    : {s['p99']:.0f} ms")
    print(f"  Max Latency    : {s['max']:.0f} ms")

    if report.failures:
        error_counts = {}
        for r in report.failures:
            error_counts[r.error] = error_counts.get(r.error, 0) + 1
        print(f"  Errors:")
        for err, count in sorted(error_counts.items(), key=lambda x: -x[1]):
            print(f"    {err}: {count}x")

    endpoints_seen = sorted(set(r.endpoint for r in report.results))
    if len(endpoints_seen) > 1:
        print(f"\n  Per-endpoint breakdown:")
        for ep in endpoints_seen:
            ep_results = [r for r in report.results if r.endpoint == ep]
            ep_success = [r for r in ep_results if r.success]
            ep_lats = sorted([r.latency_ms for r in ep_success])
            rate = len(ep_success) / len(ep_results) * 100 if ep_results else 0
            avg = statistics.mean(ep_lats) if ep_lats else 0
            p95 = ep_lats[min(int(len(ep_lats) * 0.95), len(ep_lats) - 1)] if ep_lats else 0
            print(f"    {ep:20s}  OK: {rate:5.1f}%  Avg: {avg:6.0f}ms  P95: {p95:6.0f}ms  ({len(ep_results)} reqs)")


def print_final_report(reports: list):
    print_header("FINAL SUMMARY")

    print(f"\n  {'Scenario':<15s} {'Users':>6s} {'Reqs':>6s} {'OK%':>7s} {'RPS':>8s} {'Avg':>8s} {'P50':>8s} {'P95':>8s} {'Max':>8s}")
    print(f"  {'-'*15} {'-'*6} {'-'*6} {'-'*7} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*8}")
    for r in reports:
        s = r.summary()
        print(f"  {r.label:<15s} {r.concurrent:>6d} {r.total_requests:>6d} {r.success_rate:>6.1f}% {r.rps:>7.1f}/s {s['avg']:>7.0f}ms {s['p50']:>7.0f}ms {s['p95']:>7.0f}ms {s['max']:>7.0f}ms")

    # Verdicts
    print()
    heavy = next((r for r in reports if r.concurrent >= 50), None)
    if heavy:
        if heavy.success_rate >= 95:
            print(f"  PASS: {heavy.concurrent} concurrent users — {heavy.success_rate:.1f}% success rate")
        elif heavy.success_rate >= 80:
            print(f"  OK:   {heavy.concurrent} concurrent users — {heavy.success_rate:.1f}% success rate (acceptable)")
        else:
            print(f"  WARN: {heavy.concurrent} concurrent users — {heavy.success_rate:.1f}% success rate (target: >90%)")

    for r in reports:
        if r.concurrent >= 20:
            s = r.summary()
            if s['p50'] < 300:
                print(f"  CACHE HIT: P50 {s['p50']:.0f}ms at {r.concurrent} users — cache is effective")
            elif s['p50'] < 1000:
                print(f"  CACHE PARTIAL: P50 {s['p50']:.0f}ms at {r.concurrent} users — partial cache hits")
            else:
                print(f"  CACHE MISS: P50 {s['p50']:.0f}ms at {r.concurrent} users — most requests not cached")


# ── Discovery & Warmup ────────────────────────────────────────────────────────

async def discover_product_id() -> str | None:
    """Fetch the listing page and extract a real product ID."""
    url = f"{BASE_URL}?per_page=5&page=1&skip_variations=true&status=publish"
    connector = aiohttp.TCPConnector(limit=1)
    async with aiohttp.ClientSession(connector=connector) as session:
        try:
            async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=TIMEOUT_SECONDS)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    products = data.get("products", [])
                    if products:
                        return products[0]["id"]
        except Exception as e:
            print(f"  Discovery failed: {e}")
    return None


async def warmup_endpoints(endpoints: dict):
    """Prime each endpoint's cache with a single sequential request."""
    print("\n  Warming up all endpoints (priming caches)...")
    connector = aiohttp.TCPConnector(limit=1)
    async with aiohttp.ClientSession(connector=connector) as session:
        for name, url in endpoints.items():
            result = await make_request(session, name, url)
            status = "OK" if result.success else f"FAIL ({result.error})"
            print(f"    {name:20s} -> {status} in {result.latency_ms:.0f}ms ({result.size_bytes} bytes)")
    # Let CDN/isolate caches settle
    await asyncio.sleep(2)


async def cache_test(endpoints: dict):
    """Fire 10 rapid requests to the same endpoint to verify cache hits."""
    print_header("PHASE 2: CACHE EFFECTIVENESS TEST")
    print("  Sending 10 rapid requests to a pre-cached endpoint...")
    url = list(endpoints.values())[0]
    name = list(endpoints.keys())[0]

    connector = aiohttp.TCPConnector(limit=10, limit_per_host=10)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [make_request(session, name, url) for _ in range(10)]
        results = await asyncio.gather(*tasks)

    successes = [r for r in results if r.success]
    lats = sorted([r.latency_ms for r in successes])
    if lats:
        print(f"  Results: {len(successes)}/10 OK")
        print(f"  Min: {lats[0]:.0f}ms  Avg: {statistics.mean(lats):.0f}ms  Max: {lats[-1]:.0f}ms")
        if statistics.mean(lats) < 500:
            print(f"  -> Cache is working! Average {statistics.mean(lats):.0f}ms indicates cache/CDN hits")
        else:
            print(f"  -> Responses are slow — cache may not be effective at CDN level")
    else:
        failures = [r for r in results if not r.success]
        errors = set(r.error for r in failures)
        print(f"  All 10 requests failed: {errors}")


# ── Main ───────────────────────────────────────────────────────────────────────

async def main():
    print_header("LOAD TEST: Pixel Perfect Shop - Product API")
    print(f"  Target : {BASE_URL}")
    print(f"  Timeout: {TIMEOUT_SECONDS}s per request")

    # Phase 0: Discover a valid product ID
    print_header("PHASE 0: DISCOVERY")
    print("  Finding a valid product ID...")
    product_id = await discover_product_id()
    if product_id:
        print(f"  Found product ID: {product_id}")
    else:
        print(f"  Could not find a product ID — skipping product_detail endpoint")

    # Build endpoints with real product ID
    endpoints = {
        "listing_page1": f"{BASE_URL}?per_page=20&page=1&skip_variations=true&status=publish",
        "listing_page2": f"{BASE_URL}?per_page=20&page=2&skip_variations=true&status=publish",
        "listing_search": f"{BASE_URL}?per_page=20&page=1&search=shirt&skip_variations=true&status=publish",
    }
    if product_id:
        endpoints["product_detail"] = f"{BASE_URL}?id={product_id}&skip_variations=true&status=publish"

    print(f"  Testing {len(endpoints)} endpoints")

    # Phase 1: Warmup (prime caches)
    print_header("PHASE 1: WARMUP (priming caches)")
    await warmup_endpoints(endpoints)

    # Phase 2: Cache test
    await cache_test(endpoints)

    # Phase 3: Load test scenarios
    print_header("PHASE 3: LOAD TEST SCENARIOS")
    reports = []
    for label, concurrent, rpu in SCENARIOS:
        print(f"\n  Running: {label} ({concurrent} users x {rpu} requests)...")
        report = await run_scenario(label, concurrent, rpu, endpoints)
        print(f"  Completed in {report.elapsed_s:.1f}s ({report.rps:.1f} req/s)")
        print_scenario_report(report)
        reports.append(report)
        # Brief pause between scenarios
        await asyncio.sleep(2)

    print_final_report(reports)
    print()


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
