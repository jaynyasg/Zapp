import { test } from "node:test";
import assert from "node:assert/strict";
import { providerConfig, structuredResponse } from "../server/ai.js";
const args = {
  system: "Organize records",
  content: [
    { type: "text", text: "Visitor register" },
    { type: "image", source: { media_type: "image/jpeg", data: "YWJj" } },
    { type: "document", source: { data: "cGRm" } },
  ],
  schema: {
    type: "object",
    properties: { reply: { type: "string" } },
    required: ["reply"],
    additionalProperties: false,
  },
};
test("provider selection is explicit; credentials are not returned in configuration", () => {
  assert.deepEqual(providerConfig({ OPENAI_API_KEY: "secret" }), {
    provider: "openai",
    aiEnabled: true,
  });
  assert.deepEqual(
    providerConfig({ OPENAI_API_KEY: "secret", AI_PROVIDER: "anthropic" }),
    { provider: "anthropic", aiEnabled: false },
  );
  assert.equal(
    JSON.stringify(providerConfig({ OPENAI_API_KEY: "secret" })).includes(
      "secret",
    ),
    false,
  );
});
test("OpenAI adapter sends private structured Responses requests with image and PDF inputs", async () => {
  const result = await structuredResponse(args, {
    env: { OPENAI_API_KEY: "test-key" },
    transport: async (url, opts) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(opts.body);
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.input[0].content[1].type, "input_image");
      assert.equal(
        body.input[0].content[2].file_data,
        "data:application/pdf;base64,cGRm",
      );
      return {
        ok: true,
        json: async () => ({
          status: "completed",
          output: [
            { content: [{ type: "output_text", text: '{"reply":"Ready"}' }] },
          ],
        }),
      };
    },
  });
  assert.equal(result.reply, "Ready");
});
test("Anthropic adapter validates complete tool output; errors never leak provider details", async () => {
  const env = { ANTHROPIC_API_KEY: "test-key" };
  assert.deepEqual(
    await structuredResponse(args, {
      env,
      transport: async () => ({
        ok: true,
        json: async () => ({
          content: [
            { type: "tool_use", name: "response", input: { reply: "Ready" } },
          ],
        }),
      }),
    }),
    { reply: "Ready" },
  );
  await assert.rejects(
    () =>
      structuredResponse(args, {
        env,
        transport: async () => ({
          ok: false,
          status: 429,
          json: async () => ({
            error: { message: "secret account credit balance" },
          }),
        }),
      }),
    (e) =>
      e.status === 503 &&
      /credit/.test(e.message) &&
      !e.message.includes("secret"),
  );
  await assert.rejects(
    () =>
      structuredResponse(args, {
        env,
        transport: async () => ({
          ok: true,
          json: async () => ({ stop_reason: "max_tokens", content: [] }),
        }),
      }),
    /incomplete/,
  );
});
