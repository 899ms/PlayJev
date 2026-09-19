import { describe, expect, it } from "vitest";
import { chatComplete, extractJsonBlock, LlmError } from "./client";
import { defaultBackoffMs } from "../jev/client";

describe("extractJsonBlock", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonBlock('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses a fenced JSON block with prose around it", () => {
    const reply = 'Here you go:\n```json\n{"questions": []}\n```\nDone.';
    expect(extractJsonBlock(reply)).toEqual({ questions: [] });
  });

  it("falls back to the outermost braces", () => {
    const reply = 'Sure! {"name":"x","nested":{"a":1}} hope that helps';
    expect(extractJsonBlock(reply)).toEqual({ name: "x", nested: { a: 1 } });
  });

  it("throws a SyntaxError when nothing parseable exists", () => {
    expect(() => extractJsonBlock("no json here")).toThrow(SyntaxError);
  });
});

describe("chatComplete", () => {
  const fetchJson = (body: unknown) =>
    (async () =>
      new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;

  it("reads OpenAI-shaped replies", async () => {
    const text = await chatComplete(
      { protocol: "openai", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hi" }],
      { fetchImpl: fetchJson({ choices: [{ message: { content: "hello" } }] }) }
    );
    expect(text).toBe("hello");
  });

  it("reads OpenAI Responses API output_text replies", async () => {
    const text = await chatComplete(
      { protocol: "response", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hi" }],
      { fetchImpl: fetchJson({ output_text: "response output" }) }
    );
    expect(text).toBe("response output");
  });

  it("reads OpenAI Responses API output structure replies", async () => {
    const text = await chatComplete(
      { protocol: "response", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hi" }],
      {
        fetchImpl: fetchJson({
          output: [
            {
              type: "message",
              content: [{ type: "text", text: "nested response output" }],
            },
          ],
        }),
      }
    );
    expect(text).toBe("nested response output");
  });

  it("reads custom proxy response fields", async () => {
    const text = await chatComplete(
      { protocol: "openai", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hi" }],
      { fetchImpl: fetchJson({ response: "proxy response" }) }
    );
    expect(text).toBe("proxy response");
  });

  it("reads Anthropic-shaped replies", async () => {
    const text = await chatComplete(
      { protocol: "anthropic", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hi" }],
      { fetchImpl: fetchJson({ content: [{ type: "text", text: "bonjour" }] }) }
    );
    expect(text).toBe("bonjour");
  });

  it("throws LlmError on unrecognized shapes", async () => {
    await expect(
      chatComplete(
        { protocol: "openai", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
        [{ role: "user", content: "hi" }],
        { fetchImpl: fetchJson({ weird: true }) }
      )
    ).rejects.toBeInstanceOf(LlmError);
  });
});

describe("defaultBackoffMs", () => {
  it("honors the retry-after header (seconds)", () => {
    expect(defaultBackoffMs(0, "3")).toBe(3000);
  });

  it("falls back to exponential backoff", () => {
    expect(defaultBackoffMs(0, null)).toBe(1000);
    expect(defaultBackoffMs(1, null)).toBe(2000);
  });
});
