import "server-only";

/**
 * Fonts and images for the link-unfurl images. Satori throws on an image it cannot load or decode,
 * so every remote image is fetched here first (short timeout, size cap, type sniffed) and handed to
 * satori as a data URI; anything that fails gives null and the card draws its fallback.
 *
 * The routes are public and the image URLs are user-stored (ThinkPages avatars, flags, realm
 * banners), so a fetch only goes to an allow-listed host (`isAllowedImageUrl`), never follows a
 * redirect, and stops reading once the size cap is passed.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assetUrl } from "~/lib/base-path";
import { isAllowedMediaUrl } from "~/app/api/mediawiki/_media-response";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { OG_FONT_FAMILY } from "./og-theme";

/** A font as `ImageResponse` takes it. */
export interface OgFont {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal";
}

/** The weights the cards set, from the files `src/styles/typography.css` serves. */
const FONT_FILES: ReadonlyArray<readonly [OgFont["weight"], string]> = [
  [400, "Schibsted Grotesk-Regular.ttf"],
  [500, "Schibsted Grotesk-500.ttf"],
  [600, "Schibsted Grotesk-600.ttf"],
  [700, "Schibsted Grotesk-700.ttf"],
];

const IMAGE_TIMEOUT_MS = 3000;
const IMAGE_MAX_BYTES = 6 * 1024 * 1024;

function publicFile(...segments: string[]): string {
  return join(process.cwd(), "public", ...segments);
}

async function readFont([weight, file]: (typeof FONT_FILES)[number]): Promise<OgFont | null> {
  try {
    const data = await readFile(publicFile("fonts", file));
    return { name: OG_FONT_FAMILY, data, weight, style: "normal" };
  } catch (error) {
    console.warn(`[og] font ${file} unavailable, using the default font:`, error);
    return null;
  }
}

let fonts: Promise<OgFont[]> | null = null;

/** Schibsted Grotesk from `public/fonts`, read once; a missing file is left out (default font). */
export function loadOgFonts(): Promise<OgFont[]> {
  fonts ??= Promise.all(FONT_FILES.map(readFont)).then((list) =>
    list.filter((font): font is OgFont => font !== null)
  );
  return fonts;
}

let seal: Promise<string | null> | null = null;

/** The Ixnay seal the passport masthead shows (`public/images/ix-logo.svg`); null if missing. */
export function loadOgSeal(): Promise<string | null> {
  seal ??= readFile(publicFile("images", "ix-logo.svg"))
    .then((bytes) => imageDataUri(new Uint8Array(bytes)))
    .catch(() => null);
  return seal;
}

/**
 * A stored image path as an absolute http(s) URL on `origin`: app-relative paths get the base path
 * (`assetUrl`), absolute and protocol-relative URLs are kept. Null for an empty value or any other
 * scheme (data:, blob:, file:).
 */
export function absoluteAssetUrl(raw: string | null | undefined, origin: URL): string | null {
  const scheme = /^([a-z][\w+.-]*):/i.exec(raw?.trim() ?? "")?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") return null;
  const resolved = assetUrl(raw);
  if (!resolved) return null;
  try {
    const url = new URL(resolved, origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Hosts the cards fetch images from besides the app's own origin and the wikis. The wikis (IxWiki,
 * the sister wikis and Commons, with their upload CDNs such as upload.wikimedia.org) come from the
 * media proxies' allowlist (`isAllowedMediaUrl`); flags and realm banners live there. These are
 * Clerk's image hosts and the avatar hosts listed in `images.remotePatterns` in next.config.js.
 */
const IMAGE_HOSTS: ReadonlySet<string> = new Set([
  // Clerk-hosted profile images.
  "img.clerk.com",
  "images.clerk.dev",
  // Discord avatars and attachments.
  "cdn.discordapp.com",
  "media.discordapp.net",
  // Google account avatars.
  "lh3.googleusercontent.com",
  // Stock imagery used for ThinkPages personas.
  "images.unsplash.com",
]);

/** `localhost` and IP literals are never fetched, whatever the allow-list says. */
function isBlockedHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.startsWith("[") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  );
}

/**
 * Whether the OG routes may fetch `url`: never localhost or an IP literal, never with credentials;
 * the app's own origin as is (http in dev); otherwise https on the default port to the app host, a
 * host in `IMAGE_HOSTS` or a wiki media host (exact matches).
 */
export function isAllowedImageUrl(url: URL, appOrigin: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (isBlockedHost(host) || url.username || url.password) return false;
  if (url.origin === appOrigin.origin) return true;
  if (url.protocol !== "https:" || url.port !== "") return false;
  return (
    host === appOrigin.hostname.toLowerCase() ||
    IMAGE_HOSTS.has(host) ||
    isAllowedMediaUrl(url.href)
  );
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  signature.every((byte, i) => bytes[i] === byte);

/** Satori sizes an SVG from its viewBox, else from both width and height; without them it throws. */
function isSizedSvg(bytes: Uint8Array): boolean {
  const tag = /<svg\b[^>]*>/i.exec(new TextDecoder().decode(bytes))?.[0];
  if (!tag) return false;
  return (
    /\bviewBox=['"][^'"]+['"]/.test(tag) || (/\swidth=['"]/.test(tag) && /\sheight=['"]/.test(tag))
  );
}

/** The image type satori can draw, sniffed from the bytes; null for anything else (WebP, AVIF, HTML). */
function sniffImageType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  return isSizedSvg(bytes) ? "image/svg+xml" : null;
}

/** `bytes` as a data URI satori can draw; null when satori would reject the image. */
export function imageDataUri(bytes: Uint8Array): string | null {
  const type = sniffImageType(bytes);
  return type ? `data:${type};base64,${Buffer.from(bytes).toString("base64")}` : null;
}

/** The body, or null (and the stream cancelled) as soon as it passes the size cap. */
async function readCapped(response: Response): Promise<Uint8Array | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    total += value.byteLength;
    if (total > IMAGE_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
}

/**
 * The stored image at `raw` as a data URI for satori, fetched from an allow-listed host with the
 * allow-listed user agent, a short timeout and no redirects; null when there is none, the host is not
 * allowed, or it fails, redirects, is too large or is a type satori rejects.
 */
export async function fetchOgImage(
  raw: string | null | undefined,
  origin: URL
): Promise<string | null> {
  const url = absoluteAssetUrl(raw, origin);
  if (!url || !isAllowedImageUrl(new URL(url), origin)) return null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      redirect: "error",
    });
    if (!response.ok) return null;
    if (Number(response.headers.get("content-length")) > IMAGE_MAX_BYTES) return null;
    const bytes = await readCapped(response);
    return bytes ? imageDataUri(bytes) : null;
  } catch {
    return null;
  }
}
