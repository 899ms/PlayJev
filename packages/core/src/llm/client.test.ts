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

  it("sends Responses API shape: instructions + input, no temperature", async () => {
    let gotBody = "";
    const cap = (async (input: any, init: any) => {
      gotBody = init.body as string;
      return new Response(JSON.stringify({ output_text: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    await chatComplete(
      { protocol: "response", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      { fetchImpl: cap, temperature: 0.4 }
    );
    const body = JSON.parse(gotBody) as Record<string, unknown>;
    expect(body["instructions"]).toBe("sys");
    expect(body["input"]).toEqual([{ role: "user", content: "hi" }]);
    expect("temperature" in body).toBe(false);
    expect(body["max_output_tokens"]).toBe(4096);
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

  it("reads legacy choices[0].text (third-party compat)", async () => {
    const text = await chatComplete(
      { protocol: "openai", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hi" }],
      { fetchImpl: fetchJson({ choices: [{ text: "legacy hello" }] }) }
    );
    expect(text).toBe("legacy hello");
  });

  it("reads data.choices wrapper", async () => {
    const text = await chatComplete(
      { protocol: "openai", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hi" }],
      { fetchImpl: fetchJson({ data: { choices: [{ message: { content: "wrapped" } }] } }) }
    );
    expect(text).toBe("wrapped");
  });

  it("reads output_text content parts in Responses output", async () => {
    const text = await chatComplete(
      { protocol: "response", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hi" }],
      {
        fetchImpl: fetchJson({
          output: [{ type: "message", content: [{ type: "output_text", text: "resp text" }] }],
        }),
      }
    );
    expect(text).toBe("resp text");
  });

  it("reads array message content parts in Chat replies", async () => {
    const text = await chatComplete(
      { protocol: "openai", baseUrl: "https://x/v1", apiKey: "k", model: "m" },
      [{ role: "user", content: "hi" }],
      {
        fetchImpl: fetchJson({
          choices: [{ message: { content: [{ type: "text", text: "part hello" }] } }],
        }),
      }
    );
    expect(text).toBe("part hello");
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
