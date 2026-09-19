/**
 * PlayJev local proxy — zero-dependency Node server.
 *
 *   npm run proxy          (default http://127.0.0.1:8787, PORT env to override)
 *
 * Routes:
 *   POST /api/jev/systemone  -> https://api.typesafe.ai/v1/systemone
 *   POST /api/llm            -> the full URL from the `x-llm-target` header
 *
 * Both add permissive CORS headers so the browser app can call them directly.
 * The proxy never stores or logs request bodies or keys.
 */
import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const JEV_UPSTREAM = "https://api.typesafe.ai/v1/systemone";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-llm-target",
  "Access-Control-Max-Age": "86400",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function forward(res, upstreamResponse) {
  res.writeHead(upstreamResponse.statusCode, {
    ...CORS_HEADERS,
    "Content-Type": upstreamResponse.headers["content-type"] || "application/json",
    ...(upstreamResponse.headers["retry-after"] ? { "Retry-After": upstreamResponse.headers["retry-after"] } : {}),
  });
  upstreamResponse.pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, CORS_HEADERS);
    res.end(JSON.stringify({ error: "POST only" }));
    return;
  }

  try {
    const body = await readBody(req);

    if (req.url === "/api/jev/systemone") {
      const upstream = await fetch(JEV_UPSTREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
        body,
      });
      forward(res, upstream);
      return;
    }

    if (req.url === "/api/llm") {
      const target = req.headers["x-llm-target"];
      if (typeof target !== "string" || !/^https?:\/\//.test(target)) {
        res.writeHead(400, CORS_HEADERS);
        res.end(JSON.stringify({ error: "missing or invalid x-llm-target header" }));
        return;
      }
      const upstream = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
          // pass through Anthropic-specific headers when present
          ...(req.headers["x-api-key"] ? { "x-api-key": req.headers["x-api-key"] } : {}),
          ...(req.headers["anthropic-version"] ? { "anthropic-version": req.headers["anthropic-version"] } : {}),
        },
        body,
      });
      forward(res, upstream);
      return;
    }

    res.writeHead(404, CORS_HEADERS);
    res.end(JSON.stringify({ error: "not found" }));
  } catch (err) {
    res.writeHead(502, CORS_HEADERS);
    res.end(JSON.stringify({ error: `proxy failure: ${err instanceof Error ? err.message : String(err)}` }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[playjev-proxy] listening on http://${HOST}:${PORT}`);
  console.log(`  POST ${`http://${HOST}:${PORT}`}/api/jev/systemone -> ${JEV_UPSTREAM}`);
  console.log(`  POST ${`http://${HOST}:${PORT}`}/api/llm            -> header x-llm-target`);
});
