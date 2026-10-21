import {answerForCebri, notifyCebri} from "../_shared/assistant.ts";

const json = (body:Record<string,unknown>, status=200) => new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"}});
const text = (body:string, status=200) => new Response(body, {status, headers:{"Content-Type":"text/plain; charset=utf-8", "Cache-Control":"no-store"}});

async function sha256(value:string):Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,"0")).join("");
}

async function validMetaSignature(raw:string, signature:string|null, secret:string):Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = [...new Uint8Array(signed)].map(byte => byte.toString(16).padStart(2,"0")).join("");
  const supplied = signature.slice(7).toLowerCase();
  if (expected.length !== supplied.length) return false;
  let difference = 0;
  for (let index=0; index<expected.length; index++) difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return difference === 0;
}

async function allowFirstDelivery(messageId:string, salt:string, url:string, serviceKey:string):Promise<boolean> {
  const hash = await sha256(`whatsapp-event:${messageId}:${salt}`);
  const response = await fetch(`${url}/rest/v1/rpc/allow_order_request`, {
    method:"POST",
    headers:{"apikey":serviceKey, "Authorization":`Bearer ${serviceKey}`, "Content-Type":"application/json"},
    body:JSON.stringify({p_ip_hash:hash, p_cooldown_seconds:120})
  });
  if (!response.ok) throw new Error("Webhook deduplication check failed.");
  return await response.json() === true;
}

Deno.serve(async request => {
  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) return text(challenge);
    return text("Webhook verification failed.", 403);
  }
  if (request.method !== "POST") return json({error:"Method not allowed."},405);

  const appSecret = Deno.env.get("META_APP_SECRET");
  const raw = await request.text();
  if (!appSecret || !await validMetaSignature(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    return json({error:"Invalid webhook signature."},401);
  }

  let event:Record<string,unknown>;
  try { event = JSON.parse(raw); } catch { return json({error:"Invalid webhook payload."},400); }
  if (event.object !== "whatsapp_business_account") return json({received:true});

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSalt = Deno.env.get("RATE_LIMIT_SALT");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const apiVersion = Deno.env.get("META_GRAPH_API_VERSION");
  if (!supabaseUrl || !serviceKey || !rateLimitSalt || !accessToken || !phoneNumberId || !apiVersion || !verifyToken) {
    console.error("WhatsApp assistant server settings are incomplete.");
    return json({error:"WhatsApp assistant is not configured."},503);
  }
  if (!/^v\d+\.0$/.test(apiVersion)) return json({error:"Invalid WhatsApp Graph API version setting."},500);

  try {
    const entries = Array.isArray(event.entry) ? event.entry : [];
    for (const rawEntry of entries) {
      if (!rawEntry || typeof rawEntry !== "object") continue;
      const changes = Array.isArray((rawEntry as Record<string,unknown>).changes) ? (rawEntry as Record<string,unknown>).changes as unknown[] : [];
      for (const rawChange of changes) {
        if (!rawChange || typeof rawChange !== "object") continue;
        const value = (rawChange as Record<string,unknown>).value as Record<string,unknown> | undefined;
        if (!value || !Array.isArray(value.messages)) continue;
        const metadata = value.metadata as Record<string,unknown> | undefined;
        if (metadata?.phone_number_id !== phoneNumberId) continue;
        for (const rawMessage of value.messages) {
          if (!rawMessage || typeof rawMessage !== "object") continue;
          const incoming = rawMessage as Record<string,unknown>;
          const from = typeof incoming.from === "string" ? incoming.from : "";
          const messageId = typeof incoming.id === "string" ? incoming.id : "";
          const messageType = typeof incoming.type === "string" ? incoming.type : "";
          const messageText = messageType === "text" && incoming.text && typeof incoming.text === "object"
            ? (incoming.text as Record<string,unknown>).body : null;
          if (!from || !messageId || typeof messageText !== "string" || !messageText.trim()) continue;
          if (!await allowFirstDelivery(messageId, rateLimitSalt, supabaseUrl, serviceKey)) continue;
          const answer = await answerForCebri([{role:"user", content:messageText.trim().slice(0,1_000)}]);
          const send = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
            method:"POST",
            headers:{"Authorization":`Bearer ${accessToken}`, "Content-Type":"application/json"},
            body:JSON.stringify({messaging_product:"whatsapp", recipient_type:"individual", to:from, type:"text", text:{body:`Cebri AI assistant: ${answer}`}})
          });
          if (!send.ok) {
            const detail = await send.text();
            console.error("WhatsApp message delivery failed.", detail.slice(0,300));
          } else {
            const notified = await notifyCebri("New WhatsApp assistant conversation", `Customer WhatsApp: ${from}\n\nCustomer message:\n${messageText.trim().slice(0,1_000)}\n\nAI reply:\n${answer}`);
            if (Deno.env.get("CHANNEL_ALERTS_ENABLED") === "true" && !notified) console.error("WhatsApp conversation email alert failed.");
          }
        }
      }
    }
    return json({received:true});
  } catch (error) {
    console.error("WhatsApp assistant failed.", error instanceof Error ? error.message : "Unknown error");
    return json({error:"Could not process WhatsApp message."},503);
  }
});
