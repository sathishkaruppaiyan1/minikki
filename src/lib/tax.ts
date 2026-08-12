// Tax helpers driven entirely by the store's WooCommerce configuration.
// Nothing here hardcodes a rate — if WooCommerce has no tax configured, the
// storefront shows no tax, which is the correct behaviour.
//
// These figures are for DISPLAY. The authoritative amount charged is always
// the total WooCommerce puts on the order it creates.

export interface WooTaxRate {
  id: number;
  country: string;
  state: string;
  postcode: string;
  city: string;
  /** Percentage, e.g. 5 for 5% */
  rate: number;
  name: string;
  priority: number;
  compound: boolean;
  shipping: boolean;
  class: string;
  /** Manual sort order from the WooCommerce tax table */
  order: number;
}

export interface WooTaxConfig {
  calc_taxes: boolean;
  prices_include_tax: boolean;
  tax_based_on: string;
  tax_display_cart: string;
  rates: WooTaxRate[];
}

export interface TaxAddress {
  country?: string;
  state?: string;
  postcode?: string;
  city?: string;
}

export interface TaxBreakdown {
  /** Sum of all matched rates, e.g. 5 for a single 5% rate */
  ratePercent: number;
  /** The tax portion, in currency units */
  taxAmount: number;
  /** Goods value excluding tax */
  netAmount: number;
  /** What the customer pays */
  grossAmount: number;
  /** True when the catalogue price already contains the tax */
  inclusive: boolean;
  /** Label from WooCommerce, e.g. "GST" — falls back to "Tax" */
  label: string;
  /** False when the store has tax disabled or no rate matches this address */
  applies: boolean;
}

const norm = (v?: string) => (v || "").trim().toUpperCase();

/**
 * WooCommerce matches a rate when each of country/state/postcode/city either
 * matches the address or is left blank (blank = wildcard).
 */
const rateMatchesAddress = (rate: WooTaxRate, address: TaxAddress): boolean => {
  if (rate.country && rate.country !== "*" && rate.country !== norm(address.country)) return false;
  if (rate.state && rate.state !== "*" && rate.state !== norm(address.state)) return false;
  if (rate.city && rate.city !== "*" && norm(rate.city) !== norm(address.city)) return false;
  if (rate.postcode && rate.postcode !== "*" && norm(rate.postcode) !== norm(address.postcode)) return false;
  return true;
};

/**
 * How specific a rule is. An exact state match beats a country-wide wildcard,
 * which is how WooCommerce's tax table is ordered in practice.
 */
const specificity = (rate: WooTaxRate): number =>
  (rate.state ? 8 : 0) + (rate.postcode ? 4 : 0) + (rate.city ? 2 : 0) + (rate.country ? 1 : 0);

/**
 * Mirrors WooCommerce's `WC_Tax::find_rates()`: at most ONE rate applies per
 * priority, and the rates from different priorities are summed.
 *
 * This is what makes the standard Indian setup work. With
 *   IGST  IN / *  / 5%   / priority 1
 *   CGST  IN / TN / 2.5% / priority 1
 *   SGST  IN / TN / 2.5% / priority 2
 * a Tamil Nadu customer gets CGST (more specific than IGST, so it wins
 * priority 1) + SGST = 5%, while everyone else gets IGST 5%. Summing every
 * match instead would charge a TN customer 7.5%.
 *
 * Standard class only — per-product tax classes are resolved server-side on
 * the real order.
 */
export const findApplicableRates = (
  config: WooTaxConfig | undefined,
  address: TaxAddress
): WooTaxRate[] => {
  if (!config?.calc_taxes || !Array.isArray(config.rates) || config.rates.length === 0) return [];

  const matches = config.rates.filter(
    (r) => r.class === "standard" && rateMatchesAddress(r, address)
  );
  if (matches.length === 0) return [];

  // Most specific first; ties broken by the admin table's own ordering.
  const ranked = [...matches].sort((a, b) => {
    const bySpecificity = specificity(b) - specificity(a);
    if (bySpecificity !== 0) return bySpecificity;
    if (a.order !== b.order) return a.order - b.order;
    return a.id - b.id;
  });

  const winnerPerPriority = new Map<number, WooTaxRate>();
  for (const rate of ranked) {
    if (!winnerPerPriority.has(rate.priority)) winnerPerPriority.set(rate.priority, rate);
  }

  return [...winnerPerPriority.values()].sort((a, b) => a.priority - b.priority);
};

/**
 * Split a cart subtotal into net + tax according to the store's settings.
 *
 * `subtotal` is the sum of catalogue prices. Whether that already contains the
 * tax is decided by WooCommerce's `prices_include_tax`, not by us — getting
 * this backwards is what over- or under-charges customers by the tax amount.
 */
export const calculateTax = (
  config: WooTaxConfig | undefined,
  subtotal: number,
  address: TaxAddress
): TaxBreakdown => {
  const rates = findApplicableRates(config, address);

  if (rates.length === 0) {
    return {
      ratePercent: 0,
      taxAmount: 0,
      netAmount: subtotal,
      grossAmount: subtotal,
      inclusive: false,
      label: "Tax",
      applies: false,
    };
  }

  const ratePercent = rates.reduce((sum, r) => sum + r.rate, 0);
  // A split levy shows both components: "CGST + SGST", not just "CGST".
  const label = rates.map((r) => r.name || "Tax").join(" + ");
  const inclusive = !!config?.prices_include_tax;

  if (inclusive) {
    // Price already contains the tax — extract it rather than adding it.
    const netAmount = subtotal / (1 + ratePercent / 100);
    return {
      ratePercent,
      taxAmount: round2(subtotal - netAmount),
      netAmount: round2(netAmount),
      grossAmount: round2(subtotal),
      inclusive: true,
      label,
      applies: true,
    };
  }

  const taxAmount = subtotal * (ratePercent / 100);
  return {
    ratePercent,
    taxAmount: round2(taxAmount),
    netAmount: round2(subtotal),
    grossAmount: round2(subtotal + taxAmount),
    inclusive: false,
    label,
    applies: true,
  };
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "GST (5%)" / "GST (5%) — included" */
export const formatTaxLabel = (breakdown: TaxBreakdown): string => {
  const pct = Number.isInteger(breakdown.ratePercent)
    ? String(breakdown.ratePercent)
    : breakdown.ratePercent.toFixed(2).replace(/\.?0+$/, "");
  return `${breakdown.label} (${pct}%)`;
};
