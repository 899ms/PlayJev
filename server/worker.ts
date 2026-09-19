export interface Env {
  ASSETS: {
    fetch: typeof fetch;
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-llm-target, x-api-key, anthropic-version",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    if (url.pathname === "/api/jev/systemone") {
      try {
        const body = await request.text();
        const auth = request.headers.get("authorization");
        const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(auth ? { Authorization: auth } : {}),
          },
          body,
        });
        const resHeaders = new Headers(upstream.headers);
        for (const [k, v] of Object.entries(CORS_HEADERS)) {
          resHeaders.set(k, v);
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers: resHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: `upstream proxy error: ${String(err)}` }), {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    if (url.pathname === "/api/llm") {
      try {
        const target = request.headers.get("x-llm-target");
        if (!target || !/^https?:\/\//.test(target)) {
          return new Response(JSON.stringify({ error: "missing or invalid x-llm-target" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
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
        for (const [k, v] of Object.entries(CORS_HEADERS)) {
          resHeaders.set(k, v);
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers: resHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: `llm proxy error: ${String(err)}` }), {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
