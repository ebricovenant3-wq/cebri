import {answerForCebri} from "../_shared/assistant.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

function reply(body: Record<string, unknown>, status: number, origin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      ...corsHeaders,
      ...(origin ? {"Access-Control-Allow-Origin":origin} : {})
    }
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  const origin = request.headers.get("origin") || "";
  if (!origin || !allowedOrigins.includes(origin)) return reply({error:"This website is not allowed to use the assistant."}, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, {status:204, headers:{...corsHeaders, "Access-Control-Allow-Origin":origin}});
  }
  if (request.method !== "POST") return reply({error:"Method not allowed."}, 405, origin);

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 8_192) return reply({error:"Message is too long."}, 413, origin);

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8_192) return reply({error:"Message is too long."}, 413, origin);
    input = JSON.parse(raw);
  } catch {
    return reply({error:"Please send a text message."}, 400, origin);
  }
  if (!input || typeof input !== "object" || Array.isArray(input) || !Array.isArray(input.messages)) {
    return reply({error:"Please send a text message."}, 400, origin);
  }

  const messages = input.messages.slice(-8).map((message: unknown) => {
    if (!message || typeof message !== "object") return null;
    const entry = message as Record<string, unknown>;
    if (!(["user", "assistant"].includes(String(entry.role))) || typeof entry.content !== "string") return null;
    const content = entry.content.trim();
    if (!content || content.length > 1_000) return null;
    return {role:entry.role as "user" | "assistant", content};
  });
  if (messages.some(message => message === null) || messages.length === 0 || messages.at(-1)?.role !== "user") {
    return reply({error:"Please send a valid message of 1,000 characters or less."}, 400, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rateLimitSalt = Deno.env.get("RATE_LIMIT_SALT");
  if (!supabaseUrl || !serviceKey || !rateLimitSalt || !Deno.env.get("OPENAI_API_KEY")) {
    return reply({error:"The Cebri assistant is not configured yet. Please contact us using WhatsApp or email."}, 503, origin);
  }

  try {
    const forwardedFor = request.headers.get("x-forwarded-for") || "unknown";
    const clientIp = forwardedFor.split(",")[0].trim();
    const ipHash = await sha256(`assistant:${clientIp}:${rateLimitSalt}`);
    const limitResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/allow_order_request`, {
      method:"POST",
      headers:{"apikey":serviceKey, "Authorization":`Bearer ${serviceKey}`, "Content-Type":"application/json"},
      body:JSON.stringify({p_ip_hash:ipHash, p_cooldown_seconds:3})
    });
    if (!limitResponse.ok) throw new Error("Assistant rate limit check failed.");
    if (await limitResponse.json() !== true) return reply({error:"Please wait a few seconds before sending another message."}, 429, origin);

    const answer = await answerForCebri(messages);
    return reply({answer}, 200, origin);
  } catch (error) {
    console.error("Cebri assistant request failed.", error instanceof Error ? error.message : "Unknown error");
    return reply({error:"I could not answer just now. Please try again or contact Cebri using WhatsApp or email."}, 503, origin);
  }
});
