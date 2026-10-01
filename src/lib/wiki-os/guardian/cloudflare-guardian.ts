/**
 * cloudflare-guardian.ts — WikiGuardian Cloudflare Defense Suite
 *
 * Non-blocking Cloudflare Zone edge CDN cache purging. (Editing needs a signed-in account and is
 * rate-limited and rights-checked, so there is no CAPTCHA step: plan 416 removed the Turnstile one.)
 */

import { DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";

export class CloudflareGuardian {
  /**
   * Dispatches non-blocking global edge CDN cache purge on article save
   */
  static async purgeArticleEdgeCache(slug: string, realm = "ixwiki"): Promise<void> {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiToken || !zoneId) return;

    const publicUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_MEDIAWIKI_URL;
    const purgeUrls = [`${publicUrl}/wiki/${slug}`, `${publicUrl}/projects/ixstates/wiki/${slug}`];

    try {
      await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: purgeUrls,
          tags: [`wiki_${realm}_${slug}`],
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      console.warn(`[CloudflareGuardian] Non-blocking cache purge failed for ${slug}:`, err);
    }
  }
}
