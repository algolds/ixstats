/**
 * Discord attachment proxy. Signed CDN links expire, so when a direct fetch fails
 * the message is re-read through the bot token to obtain a fresh attachment URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, fetchImage, imageResponse, IMAGE_PROXY_CORS, IMAGE_PROXY_USER_AGENT, parseAllowedUrl, type FetchedImage } from "../_lib/image-proxy";

const ALLOWED_HOSTS = ["cdn.discordapp.com", "media.discordapp.net"];
const CACHE_DURATION = 86400;
const FETCH_TIMEOUT = 30000;
const CACHE_TTL = 3600000;
const MAX_CACHE = 100;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#1e1e2e" rx="8"/>
  <g transform="translate(175,110)" opacity="0.4">
    <rect x="10" y="30" width="60" height="45" rx="4" fill="none" stroke="#6b7280" stroke-width="2"/>
    <circle cx="28" cy="45" r="6" fill="none" stroke="#6b7280" stroke-width="2"/>
    <path d="M12 68 L24 56 L32 64 L44 50 L58 68" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="200" y="170" text-anchor="middle" fill="#6b7280" font-size="13" font-family="sans-serif">Content unavailable</text>
</svg>`;
const PLACEHOLDER_BYTES = new TextEncoder().encode(PLACEHOLDER_SVG).buffer as ArrayBuffer;

const messageUrlCache = new Map<string, { url: string; expiresAt: number }>();
const failureCache = new Map<string, number>();

export const OPTIONS = corsPreflight;

function placeholderResponse() {
  return new NextResponse(PLACEHOLDER_BYTES, {
    status: 200,
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600", ...IMAGE_PROXY_CORS },
  });
}

function attachmentParts(parsedUrl: URL) {
  const parts = parsedUrl.pathname.split("/");
  const idx = parts.indexOf("attachments");
  if (idx === -1 || idx + 3 >= parts.length) return null;
  const raw = parts.slice(idx + 3).join("/");
  const q = raw.indexOf("?");
  return {
    channelId: parts[idx + 1]!,
    messageId: parts[idx + 2]!,
    msgKey: `${parts[idx + 1]}/${parts[idx + 2]}`,
    filename: decodeURIComponent(q === -1 ? raw : raw.slice(0, q)),
  };
}

export async function GET(request: NextRequest) {
  const url = parseAllowedUrl(request.nextUrl.searchParams.get("url"), ALLOWED_HOSTS);
  if (!url) return placeholderResponse();

  const image = await fetchWithFallback(url);
  return image ? imageResponse(image, CACHE_DURATION) : placeholderResponse();
}

async function fetchWithFallback(parsedUrl: URL): Promise<FetchedImage | null> {
  const direct = await fetchImage(parsedUrl.toString(), { timeoutMs: FETCH_TIMEOUT });
  if (direct) return direct;

  if (!DISCORD_BOT_TOKEN || !parsedUrl.pathname.startsWith("/attachments/")) return null;
  const parts = attachmentParts(parsedUrl);
  if (!parts) return null;

  const now = Date.now();
  const failRetryAt = failureCache.get(parts.msgKey);
  if (failRetryAt && now < failRetryAt) return null;

  const cached = messageUrlCache.get(parts.msgKey);
  if (cached && now < cached.expiresAt) return fetchImage(cached.url, { timeoutMs: FETCH_TIMEOUT });

  if (messageUrlCache.size >= MAX_CACHE) {
    const oldest = messageUrlCache.keys().next();
    if (!oldest.done) messageUrlCache.delete(oldest.value);
  }

  return apiFallback(parts);
}

async function apiFallback(parts: NonNullable<ReturnType<typeof attachmentParts>>): Promise<FetchedImage | null> {
  const { channelId, messageId, msgKey, filename } = parts;
  try {
    const apiResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "User-Agent": IMAGE_PROXY_USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (apiResponse.status === 429) {
      const retryAfter = parseInt(apiResponse.headers.get("retry-after") ?? "5", 10);
      failureCache.set(msgKey, Date.now() + retryAfter * 1000 + 1000);
      return null;
    }
    if (!apiResponse.ok) {
      failureCache.set(msgKey, Date.now() + CACHE_TTL * 24);
      return null;
    }

    const message = (await apiResponse.json()) as { attachments?: Array<{ filename: string; url: string }> };
    const attachment = message.attachments?.find((a) => a.filename === filename);
    if (!attachment?.url) {
      failureCache.set(msgKey, Date.now() + CACHE_TTL * 24);
      return null;
    }

    messageUrlCache.set(msgKey, { url: attachment.url, expiresAt: Date.now() + CACHE_TTL });
    return fetchImage(attachment.url, { timeoutMs: FETCH_TIMEOUT });
  } catch {
    failureCache.set(msgKey, Date.now() + CACHE_TTL * 24);
    return null;
  }
}
