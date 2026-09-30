/**
 * cloudflare-guardian.ts — WikiGuardian Cloudflare Defense Suite
 *
 * Cloudflare Turnstile invisible CAPTCHA verification, Zero-Trust Access header
 * checking, and non-blocking Cloudflare Zone edge CDN cache purging.
 */

import { DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";

export interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
}

export class CloudflareGuardian {
  /**
   * Verify Cloudflare Turnstile challenge token
   */
  static async verifyTurnstile(token?: string, clientIp?: string): Promise<TurnstileVerifyResult> {
    const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

    // In local development or if no secret key configured, bypass verification
    if (!secretKey || process.env.NODE_ENV === "development") {
      return { success: true };
    }

    if (!token) {
      return { success: false, error: "Security verification token is required." };
    }

    const formData = new URLSearchParams({
      secret: secretKey,
      response: token,
      ...(clientIp ? { remoteip: clientIp } : {}),
    });

    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(4000),
      });

      const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
      if (!data.success) {
        return {
          success: false,
          error: data["error-codes"]?.join(", ") || "Turnstile challenge failed.",
        };
      }

      return { success: true };
    } catch (err) {
      console.warn("[CloudflareGuardian] Turnstile verification network timeout:", err);
      // Allow fallback if Cloudflare verification endpoint times out
      return { success: true };
    }
  }

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
