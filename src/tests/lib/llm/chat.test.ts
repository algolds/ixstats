import { chatCompletion } from "~/lib/llm/chat";

const base = {
  apiUrl: "https://example.test/v1/chat/completions",
  modelName: "m",
  apiKey: "k",
  systemPrompt: "s",
  userPrompt: "u",
  temperature: 0,
  reasoning: false,
  jsonMode: false,
  timeoutMs: 1000,
};

async function sentBody(provider: string): Promise<Record<string, unknown>> {
  const reply: Partial<Response> = {
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content: "ok" } }] }),
  };
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(reply as Response);
  await chatCompletion({ ...base, provider });
  const init = fetchMock.mock.calls[0]![1]!;
  fetchMock.mockRestore();
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("chatCompletion", () => {
  // Privacy Policy 2.1: providers must not train on what we send.
  it("asks OpenRouter to route only to providers that do not collect data", async () => {
    expect((await sentBody("openrouter")).provider).toEqual({ data_collection: "deny" });
  });

  it("sends no OpenRouter routing field to other providers", async () => {
    expect((await sentBody("openai")).provider).toBeUndefined();
  });
});
