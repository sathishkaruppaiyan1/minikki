// WooCommerce identifies Indian states by two-letter code (its i18n/states/IN
// list), but the pincode lookup returns full names from India Post ("Tamil
// Nadu"). Tax rates and order addresses both need the code, so translate once
// here rather than at each call site.

export const INDIA_STATE_CODES: Record<string, string> = {
  "ANDAMAN AND NICOBAR ISLANDS": "AN",
  "ANDHRA PRADESH": "AP",
  "ARUNACHAL PRADESH": "AR",
  "ASSAM": "AS",
  "BIHAR": "BR",
  "CHANDIGARH": "CH",
  "CHHATTISGARH": "CT",
  "DADRA AND NAGAR HAVELI": "DN",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "DN",
  "DAMAN AND DIU": "DD",
  "DELHI": "DL",
  "GOA": "GA",
  "GUJARAT": "GJ",
  "HARYANA": "HR",
  "HIMACHAL PRADESH": "HP",
  "JAMMU AND KASHMIR": "JK",
  "JHARKHAND": "JH",
  "KARNATAKA": "KA",
  "KERALA": "KL",
  "LADAKH": "LA",
  "LAKSHADWEEP": "LD",
  "MADHYA PRADESH": "MP",
  "MAHARASHTRA": "MH",
  "MANIPUR": "MN",
  "MEGHALAYA": "ML",
  "MIZORAM": "MZ",
  "NAGALAND": "NL",
  "ODISHA": "OR",
  "ORISSA": "OR",
  "PUDUCHERRY": "PY",
  "PONDICHERRY": "PY",
  "PUNJAB": "PB",
  "RAJASTHAN": "RJ",
  "SIKKIM": "SK",
  "TAMIL NADU": "TN",
  "TELANGANA": "TS",
  "TRIPURA": "TR",
  "UTTAR PRADESH": "UP",
  "UTTARAKHAND": "UK",
  "UTTARANCHAL": "UK",
  "WEST BENGAL": "WB",
};

const VALID_CODES = new Set(Object.values(INDIA_STATE_CODES));

/**
 * "Tamil Nadu" → "TN". Already-valid codes pass through unchanged. Anything
 * unrecognised is returned uppercased so it still reaches WooCommerce, which
 * treats an unknown state as "no state-specific rate" rather than failing.
 */
export const toIndiaStateCode = (state?: string): string => {
  const raw = (state || "").trim().toUpperCase();
  if (!raw) return "";
  if (VALID_CODES.has(raw)) return raw;
  return INDIA_STATE_CODES[raw] || raw;
};

/** ISO country code for the country names this checkout collects. */
export const toCountryCode = (country?: string): string => {
  const raw = (country || "").trim();
  if (!raw) return "";
  if (raw.length === 2) return raw.toUpperCase();
  return raw.toUpperCase() === "INDIA" ? "IN" : raw.toUpperCase();
};
