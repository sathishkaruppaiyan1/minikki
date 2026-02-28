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
    const INTERAKT_API_KEY = Deno.env.get('INTERAKT_API_KEY');
    
    if (!INTERAKT_API_KEY) {
      console.error('INTERAKT_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Interakt API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase URL and key from environment (auto-injected in Edge Functions)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl) {
      return new Response(
        JSON.stringify({ error: 'Supabase URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role key if available (for RLS bypass), otherwise anon key
    const supabaseKey = supabaseServiceKey || supabaseAnonKey;
    if (!supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase API key not configured' }),
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

    // Format country code for Interakt API
    // Interakt expects countryCode with + sign in the payload
    const formattedCountryCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`; // "+91"
    
    // Create phone key for database (with country code and +)
    const phoneKey = `${countryCode}${formattedPhone}`; // "+919876543210"

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Store OTP in Supabase
    // Use phone_number as conflict target (existing constraint)
    // Also set phone_key if column exists (for future migration)
    const upsertData: {
      phone_number: string;
      phone_key?: string;
      otp: string;
      expires_at: string;
      created_at: string;
    } = {
      phone_number: formattedPhone,
      phone_key: phoneKey, // Will be set if column exists
      otp: otp,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    };

    const { error: dbError } = await supabase
      .from('otps')
      .upsert(upsertData, {
        onConflict: 'phone_number', // Use existing phone_number unique constraint
      });

    if (dbError) {
      console.error('Error storing OTP:', dbError);
      // Continue anyway - OTP will be sent
    }

    // Send OTP via Interakt WhatsApp
    // Per Interakt docs: "Make sure that you send the same auth code in both the body and button values"
    // Authentication template format: body has {{1}} for OTP, button has COPY_CODE
    // Match the working app pattern: countryCode and phoneNumber separately
    const messagePayload = {
      countryCode: formattedCountryCode, // "+91" (with +) - Interakt expects with +
      phoneNumber: formattedPhone, // "9876543210" (10 digits, no country code, no leading 0)
      callbackData: `otp_${formattedPhone}_${Date.now()}`,
      type: 'Template',
      template: {
        name: 'otp_login', // Template name in Interakt (must match code name exactly)
        languageCode: 'en', // Language code (must match template language)
        headerValues: [], // Empty array if no header variables
        bodyValues: [otp], // Body variable {{1}} - the OTP code (REQUIRED for auth templates)
        buttonValues: {
          '0': [otp] // Button value - OTP for copy code button (same OTP as body)
        }
      }
    };

    console.log('=== OTP Send Request ===');
    console.log('Phone:', formattedPhone);
    console.log('Country Code:', formattedCountryCode);
    console.log('Phone Key:', phoneKey);
    console.log('OTP Generated:', otp);
    console.log('Template:', 'otp_login');
    console.log('Payload:', JSON.stringify(messagePayload, null, 2));

    const response = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${INTERAKT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const responseText = await response.text();
    console.log('=== Interakt Response ===');
    console.log('Status:', response.status);
    console.log('Body:', responseText);

    let interaktSuccess = false;
    let interaktError: string | null = null;
    let responseData: { result?: boolean; message?: string; error?: string; id?: string } = {};

    try {
      responseData = JSON.parse(responseText);
      if (response.ok && responseData.result === true) {
        interaktSuccess = true;
        console.log('OTP sent successfully via template');
      } else {
        interaktError = responseData.message || responseData.error || responseText;
        console.log('Template message failed:', interaktError);
      }
    } catch (e) {
      interaktError = responseText;
      console.log('Failed to parse response:', responseText);
    }

    if (!interaktSuccess) {
      // Provide helpful error message based on the error
      let userMessage = 'Failed to send OTP via WhatsApp';
      let debugHint = '';
      
      if (interaktError?.includes('Missing variable values') || interaktError?.includes('body')) {
        userMessage = 'Template configuration mismatch. Please verify template structure in Interakt.';
        debugHint = 'Template "otp_login" must have exactly 1 body variable {{1}} for the OTP code. Check template in Interakt dashboard.';
      } else if (interaktError?.includes('template') || interaktError?.includes('not found')) {
        userMessage = 'WhatsApp template not found or not synced.';
        debugHint = 'Template "otp_login" must be created in Facebook Business Manager, then synced to Interakt. Go to Templates page and click Sync.';
      } else if (interaktError?.includes('phone') || interaktError?.includes('number')) {
        userMessage = 'Invalid phone number format';
        debugHint = 'Phone number must be 10 digits without country code.';
      } else {
        debugHint = 'Check Interakt dashboard to verify template "otp_login" exists and is approved.';
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: userMessage,
          details: interaktError,
          phoneNumber: formattedPhone,
          debug: {
            hint: debugHint,
            templateName: 'otp_login',
            languageCode: 'en',
            bodyValuesCount: 1,
            buttonValuesCount: 1
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - OTP sent
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully to your WhatsApp',
        phoneNumber: formattedPhone
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