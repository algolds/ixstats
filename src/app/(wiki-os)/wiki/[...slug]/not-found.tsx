"use client";
// src/app/(wiki-os)/wiki/[...slug]/not-found.tsx
// The 404 of /wiki/<path>: a page that does not exist (or cannot be a page). A signed-in reader is
// offered to create it, through ?action=edit.

import { usePathname, useRouter } from "next/navigation";
import { ArticleNotFound } from "~/components/wiki-os/reader/ArticleNotFound";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { stripBasePath, withBasePath } from "~/lib/base-path";
import { canonicalizeTitle, decodeTitleParam } from "~/lib/wiki-os/core/title";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";

/** The title a `/wiki/<path>` pathname names, as typed (segments decoded once and joined). */
function titleOfPath(pathname: string): string {
  return stripBasePath(pathname)
    .replace(/^\/wiki\//, "")
    .split("/")
    .map(decodeTitleParam)
    .join("/");
}

export default function WikiNotFound() {
  const router = useRouter();
  const { isSignedIn } = useWikiAuth();
  const typed = titleOfPath(usePathname());
  const canon = canonicalizeTitle(typed);
  // Special: and Media: pages cannot be created, and neither can a title MediaWiki refuses.
  const canCreate = isSignedIn && canon !== null && canon.namespaceId >= 0;

  return (
    <WikiOSLayout>
      <div className="wikios-article-container min-h-[500px]">
        <ArticleNotFound
          title={canon?.title ?? typed}
          wikiSource="ixwiki"
          canCreate={canCreate}
          onCreate={() => {
            if (canon) router.push(withBasePath(`/wiki/${canon.urlPath}?action=edit`));
          }}
        />
      </div>
    </WikiOSLayout>
  );
}
