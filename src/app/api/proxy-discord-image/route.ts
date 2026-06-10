import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

const CACHE_DURATION = 86400;
const ALLOWED_HOSTNAMES = ["cdn.discordapp.com", "media.discordapp.net"];
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const FETCH_TIMEOUT = 30000;

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

const CACHE_TTL = 3600000;
const MAX_CACHE = 100;

const messageUrlCache = new Map<string, { url: string; expiresAt: number }>();
const failureCache = new Map<string, number>();

function getMessageKey(parsedUrl: URL): string | null {
  const pathParts = parsedUrl.pathname.split("/");
  const idx = pathParts.indexOf("attachments");
  if (idx === -1 || idx + 3 >= pathParts.length) return null;
  return `${pathParts[idx + 1]}/${pathParts[idx + 2]}`;
}

function getFilename(parsedUrl: URL): string {
  const pathParts = parsedUrl.pathname.split("/");
  const idx = pathParts.indexOf("attachments");
  const raw = pathParts.slice(idx + 3).join("/");
  const qIndex = raw.indexOf("?");
  return qIndex === -1 ? decodeURIComponent(raw) : decodeURIComponent(raw.slice(0, qIndex));
}

function placeholderResponse() {
  return new NextResponse(PLACEHOLDER_BYTES, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
      ...corsHeaders,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const imageUrl = request.nextUrl.searchParams.get("url");
    if (!imageUrl) return placeholderResponse();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return placeholderResponse();
    }

    if (!ALLOWED_HOSTNAMES.includes(parsedUrl.hostname)) {
      return placeholderResponse();
    }

    const imageData = await fetchWithFallback(imageUrl, parsedUrl);
    if (!imageData) return placeholderResponse();

    return new NextResponse(imageData.buffer, {
      status: 200,
      headers: {
        "Content-Type": imageData.contentType,
        "Cache-Control": `public, max-age=${CACHE_DURATION}, immutable`,
        ...corsHeaders,
      },
    });
  } catch {
    return placeholderResponse();
  }
}

async function fetchWithFallback(
  imageUrl: string,
  parsedUrl: URL
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const direct = await directFetch(imageUrl);
  if (direct) return direct;

  if (!DISCORD_BOT_TOKEN || !parsedUrl.pathname.startsWith("/attachments/")) return null;

  const msgKey = getMessageKey(parsedUrl);
  if (!msgKey) return null;

  const now = Date.now();

  const failRetryAt = failureCache.get(msgKey);
  if (failRetryAt && now < failRetryAt) return null;

  const cached = messageUrlCache.get(msgKey);
  if (cached && now < cached.expiresAt) {
    return await directFetch(cached.url);
  }

  if (messageUrlCache.size >= MAX_CACHE) {
    const oldest = messageUrlCache.entries().next();
    if (oldest.value) messageUrlCache.delete(oldest.value[0]);
  }

  return await apiFallback(parsedUrl, msgKey);
}

async function directFetch(
  url: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "IxStats/1.0 (https://ixwiki.com; contact: admin@ixwiki.com)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const buffer = await response.arrayBuffer();
    return { buffer, contentType };
  } catch {
    return null;
  }
}

async function apiFallback(
  parsedUrl: URL,
  msgKey: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const pathParts = parsedUrl.pathname.split("/");
  const idx = pathParts.indexOf("attachments");
  const channelId = pathParts[idx + 1]!;
  const messageId = pathParts[idx + 2]!;
  const filename = getFilename(parsedUrl);

  try {
    const apiUrl = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;
    const apiResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "User-Agent": "IxStats/1.0 (https://ixwiki.com; contact: admin@ixwiki.com)",
      },
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

    const message = await apiResponse.json();
    const attachment = message.attachments?.find((a: any) => a.filename === filename);
    if (!attachment?.url) {
      failureCache.set(msgKey, Date.now() + CACHE_TTL * 24);
      return null;
    }

    messageUrlCache.set(msgKey, { url: attachment.url, expiresAt: Date.now() + CACHE_TTL });
    return await directFetch(attachment.url);
  } catch {
    failureCache.set(msgKey, Date.now() + CACHE_TTL * 24);
    return null;
  }
}
