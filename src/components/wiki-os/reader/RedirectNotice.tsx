"use client";

import Link from "next/link";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

/**
 * "(Redirected from X)": shown when the reader was sent here from a redirect page. The link opens
 * the redirect page itself (`?redirect=no`), like MediaWiki's. `from` is a title the route already
 * checked; a title that is not one shows nothing.
 */
export function RedirectNotice({ from }: { from: string }) {
  const canon = canonicalizeTitle(from);
  if (!canon) return null;

  return (
    <p className="text-muted-foreground mb-3 text-xs" role="note">
      (Redirected from{" "}
      <Link
        href={`/wiki/${canon.urlPath}?redirect=no`}
        className="hover:text-wiki underline underline-offset-2"
        prefetch={false}
      >
        {canon.title}
      </Link>
      )
    </p>
  );
}
