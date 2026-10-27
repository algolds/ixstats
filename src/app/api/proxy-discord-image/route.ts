/**
 * Discord attachment proxy. Signed CDN links expire, so when a direct fetch fails the message is re-read through the
 * bot token to obtain a fresh attachment URL, but only for a message in a channel the feed imports from (IxTwitter):
 * the ids come from the request, and the bot must not read arbitrary channels for anyone who asks.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  fetchImage,
  imageHeaders,
  imageProxyRateLimitResponse,
  imageResponse,
  IMAGE_PROXY_USER_AGENT,
  parseAllowedUrl,
  type FetchedImage,
} from "../_lib/image-proxy";

const ALLOWED_HOSTS = ["cdn.discordapp.com", "media.discordapp.net"];
const CACHE_DURATION = 86400;
const FETCH_TIMEOUT = 30000;
const CACHE_TTL = 3600000;
const MAX_CACHE = 100;
const MAX_FAILURES = 1000;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
/** The channels whose attachments the feed imports (ixtwitter-sync.ts reads the same variable and default). */
const REFRESHABLE_CHANNELS = new Set([
  process.env.DISCORD_IXTWITTER_CHANNEL_ID || "557223534418722818",
]);
const SNOWFLAKE = /^\d{15,21}$/;

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#1e1e2e" rx="8"/>
  <g transform="translate(175,110)" opacity="0.4">
    <rect x="10" y="30" width="60" height="45" rx="4" fill="none" stroke="#6b7280" stroke-width="2"/>
    <circle cx="28" cy="45" r="6" fill="none" stroke="#6b7280" stroke-width="2"/>
    <path d="M12 68 L24 56 L32 64 L44 50 L58 68" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="200" y="170" text-anchor="middle" fill="#6b7280" font-size="13" font-family="sans-serif">Content unavailable</text>
</svg>`;
const PLACEHOLDER_BYTES = new TextEncoder().encode(PLACEHOLDER_SVG);

const messageUrlCache = new Map<string, { url: string; expiresAt: number }>();
/** When each message may be retried; bounded, oldest entry evicted first. */
const failureCache = new Map<string, number>();

/** Set `key` on a map holding at most `max` entries, evicting the oldest. */
function setBounded<V>(map: Map<string, V>, key: string, value: V, max: number): void {
  map.delete(key);
  while (map.size >= max) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
  map.set(key, value);
}

function placeholderResponse(request: NextRequest) {
  return new NextResponse(PLACEHOLDER_BYTES, {
    status: 200,
    headers: imageHeaders("image/svg+xml", request.headers, "public, max-age=3600"),
  });
}

function attachmentParts(parsedUrl: URL) {
  const parts = parsedUrl.pathname.split("/");
  const idx = parts.indexOf("attachments");
  if (idx === -1 || idx + 3 >= parts.length) return null;
  const channelId = parts[idx + 1]!;
  const messageId = parts[idx + 2]!;
  if (!SNOWFLAKE.test(channelId) || !SNOWFLAKE.test(messageId)) return null;
  let filename: string;
  try {
    filename = decodeURIComponent(parts.slice(idx + 3).join("/"));
  } catch {
    return null;
  }
  return { channelId, messageId, msgKey: `${channelId}/${messageId}`, filename };
}

export async function GET(request: NextRequest) {
  const limited = await imageProxyRateLimitResponse(request, "image_proxy_discord");
  if (limited) return limited;

  const url = parseAllowedUrl(request.nextUrl.searchParams.get("url"), ALLOWED_HOSTS);
  if (!url) return placeholderResponse(request);

  const image = await fetchWithFallback(url);
  return image
    ? imageResponse(image, CACHE_DURATION, request.headers)
    : placeholderResponse(request);
}

async function fetchWithFallback(parsedUrl: URL): Promise<FetchedImage | null> {
  const direct = await fetchImage(parsedUrl, ALLOWED_HOSTS, { timeoutMs: FETCH_TIMEOUT });
  if (direct) return direct;

  if (!DISCORD_BOT_TOKEN || !parsedUrl.pathname.startsWith("/attachments/")) return null;
  const parts = attachmentParts(parsedUrl);
  if (!parts || !REFRESHABLE_CHANNELS.has(parts.channelId)) return null;

  const now = Date.now();
  const failRetryAt = failureCache.get(parts.msgKey);
  if (failRetryAt !== undefined) {
    if (now < failRetryAt) return null;
    failureCache.delete(parts.msgKey);
  }

  const cached = messageUrlCache.get(parts.msgKey);
  if (cached && now < cached.expiresAt) {
    return fetchImage(new URL(cached.url), ALLOWED_HOSTS, { timeoutMs: FETCH_TIMEOUT });
  }

  return apiFallback(parts);
}

function recordFailure(msgKey: string, retryAt: number): void {
  setBounded(failureCache, msgKey, retryAt, MAX_FAILURES);
}

async function apiFallback(
  parts: NonNullable<ReturnType<typeof attachmentParts>>
): Promise<FetchedImage | null> {
  const { channelId, messageId, msgKey, filename } = parts;
  try {
    const apiResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "User-Agent": IMAGE_PROXY_USER_AGENT,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      }
    );

    if (apiResponse.status === 429) {
      const retryAfter = parseInt(apiResponse.headers.get("retry-after") ?? "5", 10);
      recordFailure(
        msgKey,
        Date.now() + (Number.isFinite(retryAfter) ? retryAfter : 5) * 1000 + 1000
      );
      return null;
    }
    if (!apiResponse.ok) {
      recordFailure(msgKey, Date.now() + CACHE_TTL * 24);
      return null;
    }

    const message = (await apiResponse.json()) as {
      attachments?: Array<{ filename: string; url: string }>;
    };
    const attachment = message.attachments?.find((a) => a.filename === filename);
    const fresh = attachment?.url ? parseAllowedUrl(attachment.url, ALLOWED_HOSTS) : null;
    if (!fresh) {
      recordFailure(msgKey, Date.now() + CACHE_TTL * 24);
      return null;
    }

    setBounded(
      messageUrlCache,
      msgKey,
      { url: fresh.toString(), expiresAt: Date.now() + CACHE_TTL },
      MAX_CACHE
    );
    return fetchImage(fresh, ALLOWED_HOSTS, { timeoutMs: FETCH_TIMEOUT });
  } catch {
    recordFailure(msgKey, Date.now() + CACHE_TTL * 24);
    return null;
  }
}
