// Single-process router for all edge functions on the VPS.
//
// Mounts every function at /functions/v1/<name>, matching the Supabase URL shape
// so the frontend only has to change its base URL.
//
// Run by systemd with MINIKKI_ROUTER=1. See _runtime/serve.ts.
import { takeHandler, type Handler } from "./serve.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTIONS = [
  "create-cashfree-order", "create-razorpay-order", "home-banners",
  "pincode-lookup", "razorpay-reconcile", "razorpay-webhook",
  "update-user-details", "verify-cashfree-payment", "verify-otp",
  "verify-razorpay-payment", "wati-order-notification", "wati-send-otp",
  "whatsapp-send-otp", "woocommerce-categories", "woocommerce-orders",
  "woocommerce-pages", "woocommerce-payment-gateways", "woocommerce-products",
  "woocommerce-reviews", "woocommerce-taxes", "woocommerce-variation-gallery",
];

// Functions that had no verify_jwt = false in supabase/config.toml, i.e. ones
// Supabase's gateway gated. Note this gate is satisfied by the anon key, which
// ships in the frontend bundle — it proves possession of a public key, not user
// identity. denyIfUnauthorized below reproduces that exactly; do not "harden" it
// to reject the anon key without also fixing the callers.
const GATED = new Set([
  "create-cashfree-order", "home-banners", "pincode-lookup",
  "update-user-details", "verify-cashfree-payment", "wati-order-notification",
  "wati-send-otp", "woocommerce-orders", "woocommerce-pages",
  "woocommerce-payment-gateways",
]);

const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
if (!ANON_KEY || !SUPABASE_URL) {
  console.error("FATAL: SUPABASE_URL and SUPABASE_ANON_KEY are required");
  Deno.exit(1);
}
const sb = createClient(SUPABASE_URL, ANON_KEY);

const routes = new Map<string, Handler>();
for (const name of FUNCTIONS) {
  await import(`../${name}/index.ts`);
  const h = takeHandler();
  if (h) routes.set(name, h);
  else console.error(`WARN: no handler registered for ${name}`);
}
console.log(`loaded ${routes.size}/${FUNCTIONS.length} functions`);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function denyIfUnauthorized(req: Request): Promise<Response | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json(401, { error: "Missing bearer token" });
  if (token === ANON_KEY) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return json(401, { error: "Invalid token" });
  return null;
}

const PORT = Number(Deno.env.get("PORT") ?? 8000);

Deno.serve({ port: PORT, hostname: "127.0.0.1" }, async (req) => {
  const { pathname } = new URL(req.url);
  if (pathname === "/health") return new Response("ok");

  const m = pathname.match(/^\/functions\/v1\/([a-z0-9-]+)(\/.*)?$/);
  if (!m) return json(404, { error: "Not found" });

  const handler = routes.get(m[1]);
  if (!handler) return json(404, { error: `Unknown function: ${m[1]}` });

  // Preflight must reach the handler's own CORS logic. Gating OPTIONS here
  // turns every browser call to a GATED function into an opaque CORS failure.
  if (req.method !== "OPTIONS" && GATED.has(m[1])) {
    const denied = await denyIfUnauthorized(req);
    if (denied) return denied;
  }

  // The original Request is passed through untouched: razorpay-webhook verifies
  // its HMAC over the raw body, which any parse/restringify here would break.
  try {
    return await handler(req);
  } catch (err) {
    console.error(`ERROR in ${m[1]}:`, err);
    return json(500, { error: "Internal error" });
  }
});
