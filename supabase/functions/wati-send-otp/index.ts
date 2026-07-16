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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WATI_API_ENDPOINT = Deno.env.get('WATI_API_ENDPOINT'); // e.g. https://live-mt-server.wati.io/123456
    const WATI_API_KEY = Deno.env.get('WATI_API_KEY');
    const OTP_TEMPLATE = Deno.env.get('WATI_OTP_TEMPLATE') || 'otp_login';

    if (!WATI_API_ENDPOINT || !WATI_API_KEY) {
      console.error('WATI credentials not configured');
      return new Response(
        JSON.stringify({ error: 'WATI API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const payload: SendOTPPayload = await req.json();
    const { phoneNumber, countryCode = '+91' } = payload;

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove +, spaces, ensure 10 digits for India)
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/\s/g, '').replace(/^91/, '');

    if (formattedPhone.length !== 10) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid 10-digit phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneKey = `${countryCode.startsWith('+') ? countryCode : `+${countryCode}`}${formattedPhone}`; // "+919876543210"

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    const { error: dbError } = await supabase
      .from('otps')
      .upsert({
        phone_number: formattedPhone,
        phone_key: phoneKey,
        otp: otp,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'phone_number',
      });

    if (dbError) {
      console.error('Error storing OTP:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send OTP via WATI template message.
    // Template must have {{1}} in the body for the OTP code (and a COPY_CODE
    // button that also uses {{1}} if it is an Authentication template).
    const watiUrl = `${WATI_API_ENDPOINT.replace(/\/+$/, '')}/api/v1/sendTemplateMessage?whatsappNumber=91${formattedPhone}`;
    const authHeader = WATI_API_KEY.startsWith('Bearer ') ? WATI_API_KEY : `Bearer ${WATI_API_KEY}`;

    const watiPayload = {
      template_name: OTP_TEMPLATE,
      broadcast_name: OTP_TEMPLATE,
      parameters: [
        { name: '1', value: otp },
      ],
    };

    console.log('Sending OTP via WATI to:', `******${formattedPhone.slice(-4)}`, 'template:', OTP_TEMPLATE);

    const response = await fetch(watiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(watiPayload),
    });

    const responseText = await response.text();
    console.log('WATI response:', response.status, responseText.substring(0, 500));

    let watiSuccess = false;
    let watiError: string | null = null;
    try {
      const responseData = JSON.parse(responseText);
      // WATI returns { result: true, ... } on success; validWhatsAppNumber=false means the number has no WhatsApp
      if (response.ok && responseData.result !== false && responseData.validWhatsAppNumber !== false) {
        watiSuccess = true;
      } else {
        watiError = responseData.info || responseData.message || responseText;
      }
    } catch {
      watiError = responseText;
    }

    if (!watiSuccess) {
      console.error('WATI send failed:', watiError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send OTP via WhatsApp',
          details: watiError,
          debug: {
            hint: `Verify template "${OTP_TEMPLATE}" exists and is approved in the WATI dashboard, with one body variable {{1}} for the OTP.`,
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP sent successfully to your WhatsApp',
        phoneNumber: formattedPhone,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send OTP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
