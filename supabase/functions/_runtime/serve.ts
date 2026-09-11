// Serve shim.
//
// Every function calls serve(handler) at module top level. On Supabase each one
// is its own isolate, so that binds a port and is correct. On the VPS all 21 are
// imported into a single process, where 21 bind attempts would collide.
//
// When MINIKKI_ROUTER=1 (set only by the systemd unit) this captures the handler
// instead of serving. Without it the behaviour is byte-for-byte the original, so
// these functions remain deployable to Supabase unchanged.
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";

export type Handler = (req: Request) => Response | Promise<Response>;

const STANDALONE = Deno.env.get("MINIKKI_ROUTER") === "1";
let pending: Handler | null = null;

export function serve(handler: Handler) {
  if (!STANDALONE) return denoServe(handler);
  pending = handler;
}

export function takeHandler(): Handler | null {
  const h = pending;
  pending = null;
  return h;
}
