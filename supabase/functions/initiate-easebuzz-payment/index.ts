import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha512(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { txnid, amount, productinfo, firstname, email, phone, surl, furl, udf1, udf2, udf3, udf4, udf5 } = await req.json();

    const EASEBUZZ_KEY = Deno.env.get("EASEBUZZ_KEY");
    const EASEBUZZ_SALT = Deno.env.get("EASEBUZZ_SALT");
    const EASEBUZZ_ENV = Deno.env.get("EASEBUZZ_ENV") || "prod";

    if (!EASEBUZZ_KEY || !EASEBUZZ_SALT) {
      console.error("Missing EaseBuzz credentials");
      return new Response(
        JSON.stringify({ error: "EaseBuzz credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountStr = parseFloat(amount).toFixed(2);
    const u1 = udf1 || "";
    const u2 = udf2 || "";
    const u3 = udf3 || "";
    const u4 = udf4 || "";
    const u5 = udf5 || "";

    // Hash format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt
    const hashString = `${EASEBUZZ_KEY}|${txnid}|${amountStr}|${productinfo}|${firstname}|${email}|${u1}|${u2}|${u3}|${u4}|${u5}||||||${EASEBUZZ_SALT}`;

    console.log("Hash input string:", hashString);

    const hash = await sha512(hashString);

    const apiUrl = EASEBUZZ_ENV === "test"
      ? "https://testpay.easebuzz.in/payment/initiateLink"
      : "https://pay.easebuzz.in/payment/initiateLink";

    // Prepare form data
    const formData = new URLSearchParams();
    formData.append("key", EASEBUZZ_KEY);
    formData.append("txnid", txnid);
    formData.append("amount", amountStr);
    formData.append("productinfo", productinfo);
    formData.append("firstname", firstname);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("surl", surl);
    formData.append("furl", furl);
    formData.append("hash", hash);
    formData.append("udf1", u1);
    formData.append("udf2", u2);
    formData.append("udf3", u3);
    formData.append("udf4", u4);
    formData.append("udf5", u5);
    formData.append("udf6", "");
    formData.append("udf7", "");
    formData.append("udf8", "");
    formData.append("udf9", "");
    formData.append("udf10", "");

    console.log("Sending to EaseBuzz API:", apiUrl);
    console.log("Form params:", Object.fromEntries(formData));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log("EaseBuzz raw response:", responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse EaseBuzz response as JSON:", responseText);
      return new Response(
        JSON.stringify({ error: "Invalid response from EaseBuzz", raw: responseText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data.status !== 1) {
      console.error("EaseBuzz API error:", data);
      return new Response(
        JSON.stringify({ error: data.data || data.error || "Failed to initiate EaseBuzz payment", details: data }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: 1,
        access_key: data.data,
        env: EASEBUZZ_ENV,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("EaseBuzz initiation error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
