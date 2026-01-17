import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingPayload {
  phoneNumber: string;
  customerName: string;
  orderId: string;
  trackingNumber?: string;
  trackingUrl?: string;
  courierName?: string;
  orderStatus: 'confirmed' | 'shipped' | 'out_for_delivery' | 'delivered';
  estimatedDelivery?: string;
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

    const payload: TrackingPayload = await req.json();
    console.log('Tracking update payload:', JSON.stringify(payload));

    const { 
      phoneNumber, 
      customerName, 
      orderId, 
      trackingNumber, 
      trackingUrl, 
      courierName, 
      orderStatus,
      estimatedDelivery 
    } = payload;

    if (!phoneNumber || !customerName || !orderId || !orderStatus) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phoneNumber, customerName, orderId, orderStatus' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove + and ensure country code)
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');

    // Select template based on order status
    const templateMap: Record<string, string> = {
      'confirmed': 'order_confirmed',
      'shipped': 'order_shipped',
      'out_for_delivery': 'order_out_for_delivery',
      'delivered': 'order_delivered'
    };

    const templateName = templateMap[orderStatus] || 'order_update';

    // Build body values based on status
    let bodyValues: string[] = [customerName, orderId];
    
    if (orderStatus === 'shipped' && trackingNumber) {
      bodyValues.push(courierName || 'Courier', trackingNumber);
      if (estimatedDelivery) bodyValues.push(estimatedDelivery);
    } else if (orderStatus === 'out_for_delivery') {
      if (estimatedDelivery) bodyValues.push(estimatedDelivery);
    }

    const interaktPayload: any = {
      countryCode: formattedPhone.startsWith('91') ? '+91' : '+91',
      phoneNumber: formattedPhone.startsWith('91') ? formattedPhone.slice(2) : formattedPhone,
      callbackData: `tracking_${orderId}_${orderStatus}`,
      type: 'Template',
      template: {
        name: templateName,
        languageCode: 'en',
        headerValues: [],
        bodyValues: bodyValues,
      }
    };

    // Add button values if tracking URL exists
    if (trackingUrl && (orderStatus === 'shipped' || orderStatus === 'out_for_delivery')) {
      interaktPayload.template.buttonValues = {
        '0': [trackingUrl]
      };
    }

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
        JSON.stringify({ error: 'Failed to send tracking update', details: responseText }),
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
    console.error('Error sending tracking update:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
