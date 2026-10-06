// `Special:AllPages` and `Special:PrefixIndex`: the pages of a namespace in title order, 200 to a
// page. Plain markup, rendered on the server.

import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import type { PageListing } from "~/lib/wiki-os/core/page-list-service";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

export interface PageListProps extends PageListing {
  /** The special page's own path, for the "next page" link: "Special:AllPages". */
  specialPath: string;
  /** The query the list was asked with, without `from`. */
  query: Record<string, string>;
  /** Where this page starts ("" on the first). */
  from: string;
}

function pageHref(title: string): string {
  const canon = canonicalizeTitle(title);
  return withBasePath(`/wiki/${canon?.urlPath ?? encodeURIComponent(title.replace(/ /g, "_"))}`);
}

export function PageList({ pages, next, specialPath, query, from }: PageListProps) {
  const nextQuery = new URLSearchParams({ ...query, from: next ?? "" }).toString();
  if (pages.length === 0) {
    return <p className="text-muted-foreground px-4 py-6 text-sm">No pages match.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <ul className="columns-1 gap-6 text-sm sm:columns-2 lg:columns-3">
        {pages.map((page) => (
          <li key={page.title} className="break-inside-avoid py-0.5">
            <Link
              href={pageHref(page.title)}
              className={page.isRedirect ? "hover:text-wiki italic" : "hover:text-wiki"}
              prefetch={false}
            >
              {page.title}
            </Link>
          </li>
        ))}
      </ul>
      <nav aria-label="List pages" className="mt-6 flex gap-4 text-sm">
        {from && (
          <Link
            href={withBasePath(
              `/wiki/${specialPath}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ""}`
            )}
            className="hover:text-wiki"
            prefetch={false}
          >
            First page
          </Link>
        )}
        {next && (
          <Link
            href={withBasePath(`/wiki/${specialPath}?${nextQuery}`)}
            className="hover:text-wiki"
            prefetch={false}
            rel="next"
          >
            Next page
          </Link>
        )}
      </nav>
    </div>
  );
}
