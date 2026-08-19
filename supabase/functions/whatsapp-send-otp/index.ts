import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendOTPPayload {
  phoneNumber: string;
  countryCode?: string;
}

// Meta error codes we can recover from by retrying with a different shape.
const ERR_PARAM_MISMATCH = 132000; // wrong number of parameters for the template
const ERR_LANG_MISMATCH = 132001;  // template has no translation in that language

const RESEND_COOLDOWN_MS = 45 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── Meta WhatsApp Cloud API config ───────────────────────────
    const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    const PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID');
    const TEMPLATE = Deno.env.get('META_OTP_TEMPLATE') || 'login_otp';
    const GRAPH_VERSION = Deno.env.get('META_GRAPH_VERSION') || 'v22.0';
    const CONFIGURED_LANG = Deno.env.get('META_OTP_LANG') || 'en_US';

    if (!META_TOKEN || !PHONE_NUMBER_ID) {
      console.error('Meta WhatsApp credentials not configured');
      return json({ error: 'WhatsApp API not configured' }, 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Supabase not configured' }, 500);
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: SendOTPPayload = await req.json();
    const { phoneNumber, countryCode = '+91' } = payload;

    if (!phoneNumber) {
      return json({ error: 'Phone number is required' }, 400);
    }

    // Same normalisation verify-otp uses: store the bare 10-digit number.
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/\s/g, '').replace(/^91/, '');
    if (!/^\d{10}$/.test(formattedPhone)) {
      return json({ error: 'Please enter a valid 10-digit phone number' }, 400);
    }

    const dialCode = countryCode.replace(/^\+/, '') || '91';
    const phoneKey = `+${dialCode}${formattedPhone}`; // "+919876543210"
    const waNumber = `${dialCode}${formattedPhone}`;  // Meta wants no "+"
    const masked = `******${formattedPhone.slice(-4)}`;

    // ─── Throttle resends ─────────────────────────────────────────
    const { data: existing } = await supabase
      .from('otps')
      .select('created_at')
      .eq('phone_number', formattedPhone)
      .maybeSingle();

    if (existing?.created_at) {
      const elapsed = Date.now() - new Date(existing.created_at).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return json(
          { error: `Please wait ${retryAfter}s before requesting another OTP.`, retryAfter },
          429,
        );
      }
    }

    // ─── Generate + store OTP ─────────────────────────────────────
    const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const { error: dbError } = await supabase
      .from('otps')
      .upsert({
        phone_number: formattedPhone,
        phone_key: phoneKey,
        otp,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        verified: false,
      }, { onConflict: 'phone_number' });

    if (dbError) {
      console.error('Error storing OTP:', dbError);
      return json({ error: 'Failed to generate OTP. Please try again.' }, 500);
    }

    // ─── Send via Meta Cloud API ──────────────────────────────────
    // Authentication templates carry the code twice: once in the body and once
    // in the copy-code / one-tap button. A plain utility template takes it only
    // in the body, so fall back to a body-only payload when Meta complains
    // about the parameter count, and to other languages on 132001.
    const graphUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;

    const buildBody = (lang: string, withButton: boolean) => ({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: waNumber,
      type: 'template',
      template: {
        name: TEMPLATE,
        language: { code: lang },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: otp }] },
          ...(withButton
            ? [{
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: otp }],
              }]
            : []),
        ],
      },
    });

    const languages = [...new Set([CONFIGURED_LANG, 'en_US', 'en'])];
    let lastError: { code?: number; message: string; details?: string } | null = null;
    let sent: { messageId?: string; lang: string; withButton: boolean } | null = null;

    outer:
    for (const lang of languages) {
      for (const withButton of [true, false]) {
        const response = await fetch(graphUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${META_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildBody(lang, withButton)),
        });

        const text = await response.text();
        let data: any = null;
        try { data = JSON.parse(text); } catch { /* non-JSON error page */ }

        if (response.ok && data?.messages?.[0]?.id) {
          sent = { messageId: data.messages[0].id, lang, withButton };
          break outer;
        }

        const err = data?.error;
        lastError = {
          code: err?.code,
          message: err?.message || text.substring(0, 300),
          details: err?.error_data?.details,
        };
        console.error('Meta send failed', response.status, lastError.code, lastError.message, lastError.details);

        if (err?.code === ERR_LANG_MISMATCH) continue outer; // wrong language: try the next one
        if (err?.code === ERR_PARAM_MISMATCH) continue;      // wrong shape: try the other one
        break outer;                                        // anything else is fatal
      }
    }

    if (!sent) {
      // Do not leave a live OTP behind that would block the next attempt.
      await supabase.from('otps').delete().eq('phone_number', formattedPhone);

      const hints: Record<number, string> = {
        190: 'Access token is invalid or expired - generate a permanent System User token.',
        131026: 'This number cannot receive WhatsApp messages.',
        132000: `Template "${TEMPLATE}" expects a different number of variables.`,
        132001: `Template "${TEMPLATE}" is not approved in languages: ${languages.join(', ')}. Set META_OTP_LANG to the template's exact language code.`,
        133010: 'Phone number ID is not registered with the Cloud API.',
        100: 'Check META_PHONE_NUMBER_ID and that the token has whatsapp_business_messaging permission.',
      };

      return json({
        success: false,
        error: 'Failed to send OTP via WhatsApp',
        details: lastError?.details || lastError?.message,
        debug: {
          template: TEMPLATE,
          languagesTried: languages,
          metaErrorCode: lastError?.code,
          hint: lastError?.code ? hints[lastError.code] : undefined,
        },
      }, 400);
    }

    console.log('OTP sent to', masked, 'template:', TEMPLATE, 'lang:', sent.lang, 'button:', sent.withButton, 'id:', sent.messageId);

    return json({
      success: true,
      message: 'OTP sent successfully to your WhatsApp',
      phoneNumber: formattedPhone,
      messageId: sent.messageId,
    });

  } catch (error: unknown) {
    console.error('Error in send OTP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return json({ error: errorMessage }, 500);
  }
});
