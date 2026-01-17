import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewPayload {
  phoneNumber: string;
  customerName: string;
  productName: string;
  orderId: string;
  reviewLink?: string;
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

    const payload: ReviewPayload = await req.json();
    console.log('Review request payload:', JSON.stringify(payload));

    const { phoneNumber, customerName, productName, orderId, reviewLink } = payload;

    if (!phoneNumber || !customerName || !productName || !orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phoneNumber, customerName, productName, orderId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove + and ensure country code)
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');

    const interaktPayload = {
      countryCode: formattedPhone.startsWith('91') ? '+91' : '+91',
      phoneNumber: formattedPhone.startsWith('91') ? formattedPhone.slice(2) : formattedPhone,
      callbackData: `review_${orderId}`,
      type: 'Template',
      template: {
        name: 'review_request',
        languageCode: 'en',
        headerValues: [],
        bodyValues: [customerName, productName, orderId],
        buttonValues: {
          '0': [reviewLink || `https://shop-sketch-hero.lovable.app/product/${orderId}`]
        }
      }
    };

    console.log('Sending to Interakt:', JSON.stringify(interaktPayload));

    const response = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${INTERAKT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(interaktPayload),
    });

    const responseText = await response.text();
    console.log('Interakt response status:', response.status);
    console.log('Interakt response:', responseText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to send review request', details: responseText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error sending review request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
