// Per-request debug logging, off unless DEBUG_LOGS=1 is set in functions.env.
// The product functions used to log every image and meta key of every product
// (~3.7M journal lines/day), which pushed real errors out of the 1 GB journal
// within a day. Keep console.error/console.warn for things worth seeing.
const enabled = Deno.env.get("DEBUG_LOGS") === "1";

export const debugLog = (...args: unknown[]): void => {
  if (enabled) console.log(...args);
};
