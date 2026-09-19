import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function devProxyPlugin(): Plugin {
  return {
    name: "playjev-dev-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === "/api/jev/systemone" && req.method === "POST") {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const body = Buffer.concat(chunks);
            const auth = req.headers.authorization;
            const rawTarget = req.headers["x-jev-target"];
            const target =
              typeof rawTarget === "string" && /^https?:\/\//.test(rawTarget)
                ? rawTarget
                : "https://api.typesafe.ai/v1/systemone";
            const upstream = await fetch(target, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(auth ? { Authorization: auth } : {}),
              },
              body,
            });
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
            const resBody = Buffer.from(await upstream.arrayBuffer());
            res.end(resBody);
          } catch (err) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        if (req.url === "/api/llm" && req.method === "POST") {
          try {
            const target = req.headers["x-llm-target"];
            if (typeof target !== "string" || !/^https?:\/\//.test(target)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "missing or invalid x-llm-target" }));
              return;
            }
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const body = Buffer.concat(chunks);
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (req.headers.authorization) headers.Authorization = req.headers.authorization;
            if (req.headers["x-api-key"]) headers["x-api-key"] = req.headers["x-api-key"] as string;
            if (req.headers["anthropic-version"]) headers["anthropic-version"] = req.headers["anthropic-version"] as string;

            const upstream = await fetch(target, {
              method: "POST",
              headers,
              body,
            });
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
            const resBody = Buffer.from(await upstream.arrayBuffer());
            res.end(resBody);
          } catch (err) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devProxyPlugin()],
  resolve: {
    alias: {
      "@playjev/core": path.resolve(dirname, "../../packages/core/src/index.ts"),
      "@": path.resolve(dirname, "src"),
    },
  },
  server: { port: 5173 },
});
