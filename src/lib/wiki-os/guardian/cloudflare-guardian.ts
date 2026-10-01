/**
 * cloudflare-guardian.ts — WikiGuardian Cloudflare Defense Suite
 *
 * Non-blocking Cloudflare Zone edge CDN cache purging. (Editing needs a signed-in account and is
 * rate-limited and rights-checked, so there is no CAPTCHA step: plan 416 removed the Turnstile one.)
 */

import { z } from "zod/v4";
import { DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

/** Cloudflare's purge answer: `{ success, errors: [{ code, message }] }`. */
const purgeAnswer = z.object({
  success: z.boolean().optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

export class CloudflareGuardian {
  /**
   * Dispatches non-blocking global edge CDN cache purge on article save. `title` is the page's
   * title: the URLs purged are its canonical, percent-encoded ones (`/wiki/<urlPath>`, the form a
   * browser asks for: a space or an accent in a title is not purged by its raw spelling), on the
   * public host with and without the app's base path. Cloudflare's answer is read: a refused purge
   * is logged, never thrown.
   */
  static async purgeArticleEdgeCache(title: string, realm = "ixwiki"): Promise<void> {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiToken || !zoneId) return;

    const canon = canonicalizeTitle(title, { source: realm });
    if (!canon) return; // not a title MediaWiki would accept: there is no page of that name to purge

    const publicUrl = (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_MEDIAWIKI_URL).replace(
      /\/+$/,
      ""
    );
    const purgeUrls = [
      `${publicUrl}/wiki/${canon.urlPath}`,
      `${publicUrl}/projects/ixstates/wiki/${canon.urlPath}`,
    ];

    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        // One purge type per request: `files` only. (`tags` is an Enterprise feature, and a body
        // naming both is refused.) The tRPC read URLs are never purged: they expire on their own, see
        // PUBLIC_READ_CACHE_CONTROL's stale-while-revalidate in lib/wiki-os/http-cache.ts.
        body: JSON.stringify({ files: purgeUrls }),
        signal: AbortSignal.timeout(3000),
      });

      const answer = purgeAnswer.safeParse(await res.json().catch(() => null));
      const refusal = answer.success
        ? (answer.data.errors ?? []).map((error) => error.message).filter(Boolean)
        : [];
      if (!res.ok || (answer.success && answer.data.success === false)) {
        console.warn(
          `[CloudflareGuardian] Cache purge for ${canon.title} was refused (HTTP ${res.status}):`,
          refusal.join("; ") || "no reason given"
        );
      }
    } catch (err) {
      console.warn(`[CloudflareGuardian] Non-blocking cache purge failed for ${canon.title}:`, err);
    }
  }
}
