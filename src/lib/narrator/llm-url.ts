/**
 * Shared SSRF / key-exfiltration guard for admin-configurable LLM endpoints.
 * The API key is sent as a Bearer token to whatever URL is configured, so only
 * known LLM provider hosts over https are allowed.
 */
export const ALLOWED_LLM_HOSTS = ["integrate.api.nvidia.com", "openrouter.ai", "api.openai.com"];

export function isAllowedLlmApiUrl(apiUrl: string): boolean {
  try {
    const parsed = new URL(apiUrl);
    return parsed.protocol === "https:" && ALLOWED_LLM_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
