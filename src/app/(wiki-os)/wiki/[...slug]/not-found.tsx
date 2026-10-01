"use client";
// src/app/(wiki-os)/wiki/[...slug]/not-found.tsx
// The 404 of /wiki/<path>: a page that does not exist (or cannot be a page). The heading, the message and
// the search link need nothing from the viewer, so they are in the first HTML; the link to create the
// page appears for a signed-in reader who may create it (the server renders the page for everyone as an
// anonymous reader, so it cannot know).

import { usePathname } from "next/navigation";
import { DeletedPageLinks } from "~/components/wiki-os/reader/DeletedPageLinks";
import { MissingPage } from "~/components/wiki-os/reader/MissingPage";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { stripBasePath } from "~/lib/base-path";
import { canonicalizeTitle, decodeTitleParam } from "~/lib/wiki-os/core/title";
import { pageEditHref } from "~/lib/wiki-os/page-tools";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { api } from "~/trpc/react";

/** The title a `/wiki/<path>` pathname names, as typed (segments decoded once and joined). */
function titleOfPath(pathname: string): string {
  return stripBasePath(pathname)
    .replace(/^\/wiki\//, "")
    .split("/")
    .map(decodeTitleParam)
    .join("/");
}

export default function WikiNotFound() {
  const { isSignedIn } = useWikiAuth();
  const typed = titleOfPath(usePathname());
  const canon = canonicalizeTitle(typed);
  const title = canon?.title ?? typed;
  // Special: and Media: pages cannot be created, and neither can a title MediaWiki refuses.
  const creatable = canon !== null && canon.namespaceId >= 0;
  // Asked of the server (block, namespace, protection, right) once the reader is known to be signed in.
  const access = api.wikios.getEditAccess.useQuery(
    { title },
    { enabled: isSignedIn && creatable, retry: false, staleTime: 60_000 }
  );
  const canCreate = isSignedIn && creatable && access.data?.allowed === true;

  return (
    <WikiOSLayout>
      <div className="wikios-article-container min-h-[500px]">
        <MissingPage
          title={title}
          createHref={canCreate ? pageEditHref(title, null, { redlink: "1" }) : null}
          searchHref={`/util/search?q=${encodeURIComponent(title)}`}
        />
        {canon && canon.namespaceId >= 0 && (
          <DeletedPageLinks title={canon.title} enabled={isSignedIn} />
        )}
      </div>
    </WikiOSLayout>
  );
}
