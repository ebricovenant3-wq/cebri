import {answerForCebri, notifyCebri} from "../_shared/assistant.ts";

const json = (body:Record<string,unknown>, status=200) => new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"}});

async function sha256(value:string):Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,"0")).join("");
}

function decodeBase64(value:string):Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function verifyResendSignature(raw:string, request:Request, secret:string):Promise<boolean> {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now()/1000 - timestampNumber) > 300) return false;
  const encodedSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes:Uint8Array;
  try { keyBytes = decodeBase64(encodedSecret); } catch { return false; }
  const key = await crypto.subtle.importKey("raw", keyBytes, {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return signature.split(" ").some(part => {
    const [version, supplied] = part.split(",",2);
    if (version !== "v1" || !supplied || supplied.length !== expected.length) return false;
    let difference=0;
    for (let index=0; index<expected.length; index++) difference |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
    return difference === 0;
  });
}

async function allowFirstDelivery(eventId:string, salt:string, url:string, serviceKey:string):Promise<boolean> {
  const hash = await sha256(`email-event:${eventId}:${salt}`);
  const response = await fetch(`${url}/rest/v1/rpc/allow_order_request`, {
    method:"POST",
    headers:{"apikey":serviceKey, "Authorization":`Bearer ${serviceKey}`, "Content-Type":"application/json"},
    body:JSON.stringify({p_ip_hash:hash, p_cooldown_seconds:120})
  });
  if (!response.ok) throw new Error("Email webhook deduplication check failed.");
  return await response.json() === true;
}

function extractAddress(value:string):string|null {
  const match = value.match(/<([^<>]+)>/);
  const candidate = (match ? match[1] : value).trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidate) ? candidate : null;
}

function stripHtml(value:string):string {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<\/(p|div|br|li|h[1-6])\s*>/gi,"\n").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').trim();
}

Deno.serve(async request => {
  if (request.method !== "POST") return json({error:"Method not allowed."},405);
  const raw = await request.text();
  if (raw.length > 32_768) return json({error:"Webhook payload is too large."},413);
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!webhookSecret || !await verifyResendSignature(raw, request, webhookSecret)) return json({error:"Invalid webhook signature."},401);

  let event:Record<string,unknown>;
  try { event = JSON.parse(raw); } catch { return json({error:"Invalid webhook payload."},400); }
  if (event.type !== "email.received") return json({received:true});
  if (Deno.env.get("EMAIL_ASSISTANT_ENABLED") !== "true") return json({received:true, skipped:"Email assistant is disabled."});
  const data = event.data as Record<string,unknown> | undefined;
  const emailId = typeof data?.email_id === "string" ? data.email_id : "";
  const webhookId = request.headers.get("svix-id") || "";
  const from = typeof data?.from === "string" ? extractAddress(data.from) : null;
  if (!emailId || !webhookId || !from) return json({error:"Email event is incomplete."},400);
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("EMAIL_FROM");
  const businessEmail = Deno.env.get("ORDER_ALERT_EMAIL") || Deno.env.get("BUSINESS_EMAIL") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSalt = Deno.env.get("RATE_LIMIT_SALT");
  if (!resendKey || !fromEmail || !supabaseUrl || !serviceKey || !rateLimitSalt) return json({error:"Email assistant is not configured."},503);
  if (businessEmail && from.toLowerCase() === businessEmail.toLowerCase()) return json({received:true, skipped:"Business-originated email."});
  if (from.toLowerCase() === fromEmail.toLowerCase()) return json({received:true, skipped:"Assistant-originated email."});

  try {
    if (!await allowFirstDelivery(webhookId, rateLimitSalt, supabaseUrl, serviceKey)) return json({received:true, duplicate:true});
    const inboundResponse = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {headers:{"Authorization":`Bearer ${resendKey}`} });
    if (!inboundResponse.ok) throw new Error("Could not retrieve received email content.");
    const inbound = await inboundResponse.json();
    const inboundHeaders = inbound.headers && typeof inbound.headers === "object" ? inbound.headers as Record<string,string> : {};
    const autoSubmitted = Object.entries(inboundHeaders).find(([name]) => name.toLowerCase() === "auto-submitted")?.[1];
    if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") return json({received:true, skipped:"Automated email."});
    const body = typeof inbound.text === "string" && inbound.text.trim() ? inbound.text.trim() : stripHtml(typeof inbound.html === "string" ? inbound.html : "");
    const subject = typeof inbound.subject === "string" ? inbound.subject.replace(/[\r\n]+/g," ").trim().slice(0,180) : "";
    if (!body) return json({received:true, skipped:"No plain message content."});
    const answer = await answerForCebri([{role:"user", content:`Email subject: ${subject || "(no subject)"}\n\nMessage:\n${body.slice(0,1_000)}`}]);
    const originalMessageId = typeof inbound.message_id === "string" ? inbound.message_id : "";
    const send = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{"Authorization":`Bearer ${resendKey}`, "Content-Type":"application/json", "Idempotency-Key":`cebri-ai-reply-${webhookId}`},
      body:JSON.stringify({
        from:fromEmail,
        to:[from],
        reply_to:fromEmail,
        subject:`Re: ${subject || "Your message to Cebri"}`,
        text:`Hello,\n\n${answer}\n\n— Cebri Curtains & Blinds AI assistant\nFor a team member to review your request, reply to this email or contact ${businessEmail || fromEmail}.`,
        ...(originalMessageId ? {headers:{"In-Reply-To":originalMessageId, "References":originalMessageId}} : {})
      })
    });
    if (!send.ok) throw new Error(`Email reply send failed (${send.status}).`);
    const notified = await notifyCebri("New email assistant conversation", `Customer email: ${from}\nSubject: ${subject || "(no subject)"}\n\nCustomer message:\n${body.slice(0,1_000)}\n\nAI reply:\n${answer}`);
    if (Deno.env.get("CHANNEL_ALERTS_ENABLED") === "true" && !notified) console.error("Inbound email conversation alert failed.");
    return json({received:true, replied:true});
  } catch (error) {
    console.error("Email assistant failed.", error instanceof Error ? error.message : "Unknown error");
    return json({error:"Could not process inbound email."},503);
  }
});
