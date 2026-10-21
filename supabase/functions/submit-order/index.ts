const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

const jsonHeaders = {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"};

function reply(body: Record<string, unknown>, status: number, origin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...corsHeaders,
      ...(origin ? {"Access-Control-Allow-Origin":origin} : {})
    }
  });
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length <= maxLength ? cleaned : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"})[character] || character);
}

async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string, text: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{"Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json"},
      body:JSON.stringify({from, to:[to], subject, html, text})
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  const origin = request.headers.get("origin") || "";

  if (!origin || !allowedOrigins.includes(origin)) {
    return reply({error:"This website is not allowed to submit requests."}, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {status:204, headers:{...corsHeaders, "Access-Control-Allow-Origin":origin}});
  }
  if (request.method !== "POST") return reply({error:"Method not allowed."}, 405, origin);

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 16_384) return reply({error:"Request is too large."}, 413, origin);

  let input: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 16_384) return reply({error:"Request is too large."}, 413, origin);
    input = JSON.parse(rawBody);
  } catch {
    return reply({error:"Invalid request."}, 400, origin);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return reply({error:"Invalid request."}, 400, origin);
  }

  const honeypot = cleanText(input.website ?? "", 200);
  if (honeypot === null || honeypot !== "") return reply({error:"Invalid request."}, 400, origin);

  const name = cleanText(input.name, 100);
  const phone = cleanText(input.phone, 30);
  let email = cleanText(input.email ?? "", 254);
  const address = cleanText(input.address ?? "", 350);
  const notes = cleanText(input.notes ?? "", 1000);
  if (!name || name.length < 2 || !phone || phone.length < 7 || !/^[+()\d .-]+$/.test(phone)
    || email === null || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    || address === null || notes === null || input.consent !== true) {
    return reply({error:"Check your name, phone number, email, and consent, then try again."}, 400, origin);
  }

  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 25) {
    return reply({error:"Your bag has an invalid number of items."}, 400, origin);
  }

  const items = [];
  for (const item of input.items) {
    if (!item || typeof item !== "object") return reply({error:"An item in your bag is invalid."}, 400, origin);
    const entry = item as Record<string, unknown>;
    const id = entry.id;
    const itemName = cleanText(entry.name, 120);
    const quantity = entry.quantity;
    if (!Number.isSafeInteger(id) || Number(id) < 1 || !itemName || !Number.isSafeInteger(quantity)
      || Number(quantity) < 1 || Number(quantity) > 99) {
      return reply({error:"An item in your bag is invalid."}, 400, origin);
    }
    items.push({id:Number(id), name:itemName, quantity:Number(quantity)});
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSalt = Deno.env.get("RATE_LIMIT_SALT");
  if (!supabaseUrl || !serviceKey || !rateLimitSalt) {
    console.error("Order backend is missing required server configuration.");
    return reply({error:"Order requests are temporarily unavailable. Please contact Cebri on WhatsApp."}, 503, origin);
  }

  try {
    let customerUserId: string | null = null;
    const customerAuthorization = request.headers.get("authorization");
    if (customerAuthorization) {
      const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers:{"apikey":serviceKey, "Authorization":customerAuthorization}
      });
      if (!userResponse.ok) return reply({error:"Your sign-in has expired. Please sign in again and retry."}, 401, origin);
      const authUser = await userResponse.json();
      customerUserId = typeof authUser.id === "string" ? authUser.id : null;
      if (!customerUserId) return reply({error:"Could not verify your customer account."}, 401, origin);
      if (!email && typeof authUser.email === "string") email = cleanText(authUser.email, 254);
    }
    const forwardedFor = request.headers.get("x-forwarded-for") || "unknown";
    const clientIp = forwardedFor.split(",")[0].trim();
    const ipHash = await sha256(`order:${clientIp}:${rateLimitSalt}`);
    const apiHeaders = {"apikey":serviceKey, "Authorization":`Bearer ${serviceKey}`, "Content-Type":"application/json"};
    const limitResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/allow_order_request`, {
      method:"POST", headers:apiHeaders, body:JSON.stringify({p_ip_hash:ipHash, p_cooldown_seconds:30})
    });
    if (!limitResponse.ok) throw new Error("Rate limit check failed.");
    if (await limitResponse.json() !== true) return reply({error:"Please wait a little before sending another request."}, 429, origin);

    const orderResponse = await fetch(`${supabaseUrl}/rest/v1/orders?select=id`, {
      method:"POST",
      headers:{...apiHeaders, "Prefer":"return=representation"},
      body:JSON.stringify({
        customer_name:name,
        customer_phone:phone,
        customer_email:email || null,
        customer_user_id:customerUserId,
        delivery_address:address,
        customer_notes:notes,
        payment_preference:"Bank transfer after quote approval",
        items,
        privacy_consent:true
      })
    });
    if (!orderResponse.ok) throw new Error("Order save failed.");
    const [savedOrder] = await orderResponse.json();
    const reference = `CBR-${savedOrder.id.slice(0, 8).toUpperCase()}`;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const alertEmail = Deno.env.get("ORDER_ALERT_EMAIL");
    const fromEmail = Deno.env.get("EMAIL_FROM");
    const escapedItems = items.map(item => `<li>${escapeHtml(item.name)} × ${item.quantity}</li>`).join("");
    let businessEmailSent = false;
    let customerEmailSent = false;

    if (resendKey && fromEmail && alertEmail) {
      const emailText = `New Cebri quote request ${reference}\nCustomer: ${name}\nPhone: ${phone}\nEmail: ${email || "Not provided"}\nAddress: ${address || "Not provided"}\nItems:\n${items.map(item => `- ${item.name} x ${item.quantity}`).join("\n")}\nNotes: ${notes || "Not provided"}`;
      const emailHtml = `<h2>New Cebri quote request ${reference}</h2><p><strong>Customer:</strong> ${escapeHtml(name)}<br><strong>Phone:</strong> ${escapeHtml(phone)}<br><strong>Email:</strong> ${escapeHtml(email || "Not provided")}<br><strong>Address:</strong> ${escapeHtml(address || "Not provided")}</p><h3>Items</h3><ul>${escapedItems}</ul><p><strong>Notes:</strong> ${escapeHtml(notes || "Not provided")}</p>`;
      businessEmailSent = await sendEmail(resendKey, fromEmail, alertEmail, `New quote request ${reference}`, emailHtml, emailText);
      if (!businessEmailSent) console.error("Business order notification email failed.");

      if (email) {
        const customerText = `Thank you for contacting Cebri Curtains & Blinds. We received your quote request ${reference}. Our team will review your selected items and contact you to confirm details and a quote. No payment is due until Cebri confirms your order and verified payment instructions.`;
        const customerHtml = `<p>Thank you for contacting Cebri Curtains &amp; Blinds.</p><p>We received your quote request <strong>${reference}</strong>. Our team will review it and contact you to confirm the details and quote.</p><p>No payment is due until Cebri confirms your order and verified payment instructions.</p>`;
        customerEmailSent = await sendEmail(resendKey, fromEmail, email, `Cebri received your request ${reference}`, customerHtml, customerText);
        if (!customerEmailSent) console.error("Customer order confirmation email failed.");
      }

      await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${savedOrder.id}`, {
        method:"PATCH",
        headers:{...apiHeaders, "Prefer":"return=minimal"},
        body:JSON.stringify({business_email_sent:businessEmailSent, customer_email_sent:customerEmailSent})
      }).catch(() => null);
    }

    return reply({ok:true, reference, alertSent:businessEmailSent}, 201, origin);
  } catch (error) {
    console.error("Order submission failed.", error instanceof Error ? error.message : "Unknown error");
    return reply({error:"We could not save your request. Please contact Cebri on WhatsApp."}, 503, origin);
  }
});
