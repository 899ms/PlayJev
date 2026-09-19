export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-llm-target, x-api-key, anthropic-version",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const target = request.headers.get("x-llm-target");
    if (!target || !/^https?:\/\//.test(target)) {
      return new Response(JSON.stringify({ error: "missing or invalid x-llm-target" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
    const body = await request.text();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = request.headers.get("authorization");
    if (auth) headers.Authorization = auth;
    const xApiKey = request.headers.get("x-api-key");
    if (xApiKey) headers["x-api-key"] = xApiKey;
    const anthropicVer = request.headers.get("anthropic-version");
    if (anthropicVer) headers["anthropic-version"] = anthropicVer;

    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body,
    });
    const resHeaders = new Headers(upstream.headers);
    resHeaders.set("Access-Control-Allow-Origin", "*");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}
