"use client";

import Link from "next/link";
import { publicArticleUrl, type WikiSource } from "~/lib/wiki-os/config";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

/**
 * "(Redirected from X)": shown when the reader was sent here from a redirect page. The link opens
 * the redirect page itself (`?redirect=no`), like MediaWiki's: on its own wiki for another wiki's
 * redirect, which the reader does not show. `from` is a title the server already checked; a title
 * that is not one shows nothing.
 */
export function RedirectNotice({
  from,
  wikiSource = "ixwiki",
}: {
  from: string;
  wikiSource?: WikiSource;
}) {
  const canon = canonicalizeTitle(from);
  if (!canon) return null;
  const className = "hover:text-wiki underline underline-offset-2";

  return (
    <p className="text-muted-foreground mb-3 text-xs" role="note">
      (Redirected from{" "}
      {wikiSource === "ixwiki" ? (
        <Link href={`/wiki/${canon.urlPath}?redirect=no`} className={className} prefetch={false}>
          {canon.title}
        </Link>
      ) : (
        <a href={`${publicArticleUrl(canon.title, wikiSource)}?redirect=no`} className={className}>
          {canon.title}
        </a>
      )}
      )
    </p>
  );
}
