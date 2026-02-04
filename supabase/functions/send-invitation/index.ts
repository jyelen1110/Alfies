import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  try {
    const body = await req.json();
    const { to, tenantName, inviterName } = body;

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured", keyExists: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (!to || !tenantName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing to or tenantName" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const fromName = tenantName || "Alfie's Food Co.";

    const emailBody = {
      from: "Alfie's Food Co. <onboarding@resend.dev>",
      to: [to],
      subject: `You're invited to order from ${fromName}`,
      html: `<h1>You're Invited!</h1><p>You've been invited to place orders with <strong>${fromName}</strong>.</p><p>To get started:</p><ol><li>Download the Alfie's app</li><li>Tap "Have an invitation? Register here"</li><li>Enter your email: <strong>${to}</strong></li><li>Complete your registration</li></ol>`,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailBody),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data.message || "Resend error", resendStatus: res.status, resendData: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
