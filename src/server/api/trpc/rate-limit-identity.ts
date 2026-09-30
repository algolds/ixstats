/**
 * Trust model: production traffic arrives via Cloudflare → nginx → Next.js. Cloudflare overwrites
 * CF-Connecting-IP with the real client IP. X-Real-IP is nginx's $remote_addr (the Cloudflare edge
 * unless nginx real_ip is configured). X-Forwarded-For and X-RateLimit-Identifier are client-controlled
 * and are never used. ASSUMPTION: the origin only accepts connections from Cloudflare; if it is
 * directly reachable, CF-Connecting-IP can be forged.
 */
export function resolveRateLimitIdentifier(headers: Headers, realUserId: string | null): string {
  if (realUserId) return `user:${realUserId}`;
  const ip = headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim();
  return ip ? `ip:${ip}` : "anonymous";
}
