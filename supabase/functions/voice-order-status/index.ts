const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-voice-secret, authorization",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: Record<string, string>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    const aByte = i < aBytes.length ? aBytes[i] : 0;
    const bByte = i < bBytes.length ? bBytes[i] : 0;
    diff |= aByte ^ bByte;
  }
  return diff === 0;
}

function extractProvidedSecret(req: Request): string | null {
  const headerSecret = req.headers.get("x-voice-secret");
  if (headerSecret !== null) {
    return headerSecret;
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== null) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1];
    }
  }
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const voiceAgentSecret = Deno.env.get("VOICE_AGENT_SECRET") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !voiceAgentSecret || voiceAgentSecret.length < 32) {
    return jsonResponse({ error: "not_configured" }, 500);
  }

  const providedSecret = extractProvidedSecret(req);
  if (!providedSecret || !constantTimeEqual(providedSecret, voiceAgentSecret)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return jsonResponse({ error: "bad_request" }, 400);
  }

  if (rawBody.length >= 2000) {
    return jsonResponse({ error: "too_large" }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "bad_request" }, 400);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return jsonResponse({ error: "bad_request" }, 400);
  }

  const payload = parsed as Record<string, unknown>;
  const rawFromNumber = payload.from_number;
  if (typeof rawFromNumber !== "string") {
    return jsonResponse({ result: "no_caller_number" }, 200);
  }
  const fromNumber = rawFromNumber.trim();
  if (fromNumber.length === 0 || fromNumber.length > 30) {
    return jsonResponse({ result: "no_caller_number" }, 200);
  }

  const rawProductHint = payload.product_hint;
  let productHint: string | null = null;
  if (typeof rawProductHint === "string") {
    const trimmedHint = rawProductHint.trim();
    if (trimmedHint.length > 0) {
      productHint = trimmedHint.slice(0, 100);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const rpcUrl = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/voice_lookup`;
    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_phone: fromNumber,
        p_product_hint: productHint,
      }),
      signal: controller.signal,
    });

    if (!rpcRes.ok) {
      console.error("voice_lookup_failed", rpcRes.status);
      return jsonResponse({ error: "lookup_failed" }, 502);
    }

    const rpcBody = await rpcRes.text();
    JSON.parse(rpcBody);
    return new Response(rpcBody, {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch {
    console.error("voice_lookup_error", 0);
    return jsonResponse({ error: "lookup_failed" }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
});
