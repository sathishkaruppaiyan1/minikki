import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hmacHex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

interface VerifyOTPPayload {
  phoneNumber: string;
  otp: string;
  name?: string;
  email?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const payload: VerifyOTPPayload = await req.json();
    const { phoneNumber, otp, name, email } = payload;

    if (!phoneNumber || !otp) {
      return new Response(
        JSON.stringify({ error: 'Phone number and OTP are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/\s/g, '').replace(/^91/, '');
    
    // Create phone key (with country code) to match storage format
    const phoneKey = `+91${formattedPhone}`; // "+919876543210"

    // Verify OTP from database - try phone_key first, fallback to phone_number
    let { data: otpData, error: otpError } = await supabase
      .from('otps')
      .select('*')
      .eq('phone_key', phoneKey) // Try phone_key first (if column exists)
      .maybeSingle();
    
    // Fallback to phone_number if phone_key lookup fails or column doesn't exist
    if (otpError || !otpData) {
      const { data, error } = await supabase
        .from('otps')
        .select('*')
        .eq('phone_number', formattedPhone) // Fallback to phone_number
        .maybeSingle();
      
      if (!error && data) {
        otpData = data;
        otpError = null;
      } else {
        otpError = error;
      }
    }

    if (otpError || !otpData) {
      return new Response(
        JSON.stringify({ error: 'OTP not found. Please request a new OTP.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if OTP is expired
    if (new Date(otpData.expires_at) < new Date()) {
      // Delete expired OTP (try phone_key, fallback to phone_number)
      if (otpData.phone_key) {
        await supabase.from('otps').delete().eq('phone_key', otpData.phone_key);
      } else {
        await supabase.from('otps').delete().eq('phone_number', formattedPhone);
      }
      return new Response(
        JSON.stringify({ error: 'OTP has expired. Please request a new OTP.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OTP verified - create or update user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert({
        phone_number: formattedPhone,
        name: name || `User ${formattedPhone}`,
        email: email || null,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'phone_number',
      })
      .select()
      .single();

    if (userError) {
      console.error('Error creating/updating user:', userError);
      // Continue - OTP is verified
    }

    // Delete used OTP (one-time use - matches working app)
    // Try phone_key first, fallback to phone_number
    if (otpData.phone_key) {
      await supabase.from('otps').delete().eq('phone_key', otpData.phone_key);
    } else {
      await supabase.from('otps').delete().eq('phone_number', formattedPhone);
    }

    // Generate HMAC-signed session token; woocommerce-orders verifies the
    // signature with the same key, so the phone number inside is trusted.
    const payloadB64 = btoa(JSON.stringify({
      phoneNumber: formattedPhone,
      userId: userData?.id || formattedPhone,
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    }));
    const signingKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const sessionToken = `${payloadB64}.${await hmacHex(signingKey, payloadB64)}`;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Login successful',
        user: {
          phoneNumber: formattedPhone,
          name: userData?.name || name || `User ${formattedPhone}`,
          email: userData?.email || email,
        },
        sessionToken,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in verify OTP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
