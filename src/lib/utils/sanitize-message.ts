/**
 * sanitizeMessageContent: sanitizeUserContent for private messages, where a remote `<img>` is a tracking pixel. It
 * shares sanitizeUserContent's allowlist (`USER_CONTENT_CONFIG`) and data:-URI hook from sanitize-html.ts.
 */

import { appOrigin } from "~/lib/app-url";
import { stripPositioning } from "~/lib/thinkpages-forum/strip-positioning";
import {
  createPurifier,
  installSharedHooks,
  USER_CONTENT_CONFIG,
  type Purifier,
} from "./sanitize-html";

let messagePurifier: Purifier | null = null;

/** The site origin an `<img>` in a private message may load from, besides a relative path. */
const MESSAGE_IMAGE_EXTRA_ORIGIN = "https://ixwiki.com";

function ownSiteOrigin(): string | null {
  try {
    return appOrigin();
  } catch {
    return null; // production without a public URL: only the extra origin counts
  }
}

/**
 * True for a relative path starting with one `/` (not `//` or `/\\`, which a browser reads as another host), or for an
 * absolute http(s) URL on the app's own origin or on ixwiki.com.
 */
function isMessageImageAllowed(src: string): boolean {
  const value = src.trim();
  if (value.startsWith("/")) return !/^\/[/\\]/.test(value);
  if (!URL.canParse(value)) return false;
  const origin = new URL(value).origin;
  return origin === MESSAGE_IMAGE_EXTRA_ORIGIN || origin === ownSiteOrigin();
}

function getMessagePurifier(): Purifier {
  if (messagePurifier) return messagePurifier;
  const created = createPurifier(true);
  installSharedHooks(created);
  // A remote <img> is a tracking pixel in a private message: remove the tag, not just its src.
  created.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName !== "img") return;
    const src = (node as Element).getAttribute("src") ?? "";
    if (!isMessageImageAllowed(src)) (node as Element).remove();
  });
  messagePurifier = created;
  return created;
}

/**
 * sanitizeUserContent for private messages: the same allowlist, but an `<img>` survives only when its `src` is a
 * relative path on this site or on ixwiki.com. Any other image (a remote one can report when a message is read)
 * is removed.
 */
export function sanitizeMessageContent(html: string): string {
  if (!html) return "";
  return stripPositioning(getMessagePurifier().sanitize(html, USER_CONTENT_CONFIG));
}
