import { isAllowedLlmApiUrl } from "~/lib/llm/url";

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
