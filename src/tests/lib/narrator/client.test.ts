import { isAllowedLlmApiUrl } from "~/lib/narrator/llm-url";

const findMany = jest.fn();
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { systemConfig: { findMany: (...args: unknown[]) => findMany(...args) } },
}));

import { getLLMConfig, queryLLM } from "~/lib/narrator/client";

describe("isAllowedLlmApiUrl", () => {
  it("allows known https provider hosts", () => {
    expect(isAllowedLlmApiUrl("https://integrate.api.nvidia.com/v1/chat/completions")).toBe(true);
    expect(isAllowedLlmApiUrl("https://openrouter.ai/api/v1/chat/completions")).toBe(true);
    expect(isAllowedLlmApiUrl("https://api.openai.com/v1/chat/completions")).toBe(true);
  });

  it("rejects internal, foreign, non-https and malformed URLs", () => {
    expect(isAllowedLlmApiUrl("http://127.0.0.1:8080/v1")).toBe(false);
    expect(isAllowedLlmApiUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedLlmApiUrl("https://evil.example.com/v1/chat/completions")).toBe(false);
    expect(isAllowedLlmApiUrl("https://api.openai.com.evil.example/v1")).toBe(false);
    expect(isAllowedLlmApiUrl("http://api.openai.com/v1")).toBe(false);
    expect(isAllowedLlmApiUrl("not a url")).toBe(false);
  });
});

describe("narrator LLM client", () => {
  const originalFetch = global.fetch;
  const envKeys = [
    "NARRATOR_LLM_API_KEY",
    "SPORTS_LLM_API_KEY",
    "SPORTS_LLM_API_URL",
    "SPORTS_LLM_PROVIDER",
  ];

  beforeEach(() => {
    findMany.mockReset();
    for (const k of envKeys) delete process.env[k];
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const k of envKeys) delete process.env[k];
    jest.restoreAllMocks();
  });

  it("does not fall back to the sports:llm:* DB key", async () => {
    findMany.mockResolvedValue([{ key: "sports:llm:apiKey", value: "sports-secret" }]);
    expect(await getLLMConfig()).toBeNull();
    const keys = (findMany.mock.calls[0]![0] as { where: { key: { in: string[] } } }).where.key.in;
    expect(keys.some((k) => k.startsWith("sports:"))).toBe(false);
  });

  it("does not fall back to SPORTS_LLM_* env vars", async () => {
    findMany.mockResolvedValue([]);
    process.env.SPORTS_LLM_API_KEY = "sports-env-secret";
    expect(await getLLMConfig()).toBeNull();
  });

  it("uses narrator:llm:* keys when present", async () => {
    findMany.mockResolvedValue([
      { key: "narrator:llm:apiKey", value: "narrator-key" },
      { key: "narrator:llm:provider", value: "openrouter" },
    ]);
    expect(await getLLMConfig()).toMatchObject({ apiKey: "narrator-key", provider: "openrouter" });
  });

  it("refuses to send the API key to a disallowed apiUrl (SSRF guard)", async () => {
    findMany.mockResolvedValue([
      { key: "narrator:llm:apiKey", value: "narrator-key" },
      { key: "narrator:llm:apiUrl", value: "http://169.254.169.254/latest" },
    ]);
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await queryLLM("sys", "user")).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls an allowed provider host", async () => {
    findMany.mockResolvedValue([
      { key: "narrator:llm:apiKey", value: "narrator-key" },
      { key: "narrator:llm:apiUrl", value: "https://openrouter.ai/api/v1" },
    ]);
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "hello" } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await queryLLM("sys", "user")).toBe("hello");
    expect(fetchMock.mock.calls[0]![0]).toBe("https://openrouter.ai/api/v1/chat/completions");
  });
});
