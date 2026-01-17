import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccountPayload {
  phoneNumber: string;
  customerName: string;
  email?: string;
  welcomeMessage?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    const payload: AccountPayload = await req.json();
    console.log('Account creation payload:', JSON.stringify(payload));

    const { phoneNumber, customerName, email, welcomeMessage } = payload;

    if (!phoneNumber || !customerName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phoneNumber, customerName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove + and ensure country code)
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');

    // First, create/update user in Interakt
    const userPayload = {
      phoneNumber: formattedPhone.startsWith('91') ? formattedPhone.slice(2) : formattedPhone,
      countryCode: '+91',
      traits: {
        name: customerName,
        email: email || '',
        source: 'website',
        created_at: new Date().toISOString()
      }
    };

    console.log('Creating user in Interakt:', JSON.stringify(userPayload));

    const userResponse = await fetch('https://api.interakt.ai/v1/public/track/users/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${INTERAKT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userPayload),
    });

    const userResponseText = await userResponse.text();
    console.log('Interakt user creation response:', userResponse.status, userResponseText);

    // Now send welcome message
    const messagePayload = {
      countryCode: '+91',
      phoneNumber: formattedPhone.startsWith('91') ? formattedPhone.slice(2) : formattedPhone,
      callbackData: `welcome_${customerName.replace(/\s/g, '_')}`,
      type: 'Template',
      template: {
        name: 'welcome_message',
        languageCode: 'en',
        headerValues: [],
        bodyValues: [customerName],
        buttonValues: {
          '0': ['https://shop-sketch-hero.lovable.app']
        }
      }
    };

    console.log('Sending welcome message:', JSON.stringify(messagePayload));

    const messageResponse = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${INTERAKT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const messageResponseText = await messageResponse.text();
    console.log('Interakt message response status:', messageResponse.status);
    console.log('Interakt message response:', messageResponseText);

    if (!messageResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send welcome message', 
          details: messageResponseText,
          userCreated: userResponse.ok 
        }),
        { status: messageResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseData;
    try {
      responseData = JSON.parse(messageResponseText);
    } catch {
      responseData = { message: messageResponseText };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: responseData,
        userCreated: userResponse.ok
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in account creation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
