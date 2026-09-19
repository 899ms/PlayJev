/**
 * PlayJev single-process server & proxy — zero-dependency Node server.
 *
 *   npm start              (default http://127.0.0.1:8787, PORT env to override)
 *   npm run proxy          (same server, proxy mode)
 *
 * Features:
 *   - Built-in static file server for apps/web/dist (SPA fallback to index.html)
 *   - Built-in reverse proxy for POST /api/jev/systemone (removes CORS restrictions)
 *   - Built-in reverse proxy for POST /api/llm (forwarded via x-llm-target header)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../apps/web/dist");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const JEV_UPSTREAM = "https://api.typesafe.ai/v1/systemone";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-llm-target, x-api-key, anthropic-version",
  "Access-Control-Max-Age": "86400",
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(DIST_DIR)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>PlayJev Proxy Server</h1><p>Static bundle not built yet. Run <code>npm run build</code> first.</p>`);
    return;
  }

  let filePath = path.join(DIST_DIR, pathname === "/" ? "index.html" : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, "index.html");
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // Static file serving for GET/HEAD
  if (req.method === "GET" || req.method === "HEAD") {
    if (!url.pathname.startsWith("/api/")) {
      serveStatic(req, res, url.pathname);
      return;
    }
  }

  if (req.method !== "POST") {
    res.writeHead(405, CORS_HEADERS);
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readBody(req);

    if (url.pathname === "/api/jev/systemone") {
      const upstream = await fetch(JEV_UPSTREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
        body,
      });
      const headers = { ...CORS_HEADERS, "Content-Type": upstream.headers.get("content-type") || "application/json" };
      const retryAfter = upstream.headers.get("retry-after");
      if (retryAfter) headers["Retry-After"] = retryAfter;

      res.writeHead(upstream.status, headers);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
      return;
    }

    if (url.pathname === "/api/llm") {
      const target = req.headers["x-llm-target"];
      if (typeof target !== "string" || !/^https?:\/\//.test(target)) {
        res.writeHead(400, CORS_HEADERS);
        res.end(JSON.stringify({ error: "missing or invalid x-llm-target header" }));
        return;
      }
      const headers = { "Content-Type": "application/json" };
      if (req.headers.authorization) headers.Authorization = req.headers.authorization;
      if (req.headers["x-api-key"]) headers["x-api-key"] = req.headers["x-api-key"];
      if (req.headers["anthropic-version"]) headers["anthropic-version"] = req.headers["anthropic-version"];

      const upstream = await fetch(target, {
        method: "POST",
        headers,
        body,
      });
      const resHeaders = { ...CORS_HEADERS, "Content-Type": upstream.headers.get("content-type") || "application/json" };
      res.writeHead(upstream.status, resHeaders);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
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
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`[playjev] Single-process server running on http://${displayHost}:${PORT}`);
  console.log(`  Web UI:                  http://${displayHost}:${PORT}/`);
  console.log(`  Jev Reverse Proxy:       http://${displayHost}:${PORT}/api/jev/systemone`);
  console.log(`  LLM Target Proxy:        http://${displayHost}:${PORT}/api/llm`);
});
