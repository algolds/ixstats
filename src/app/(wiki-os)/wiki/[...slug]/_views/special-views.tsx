import "server-only";

import { notFound, redirect } from "next/navigation";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { PageList } from "~/components/wiki-os/reader/PageList";
import { getBasePath } from "~/lib/base-path";
import type { SpecialAction, SpecialTarget } from "~/lib/wiki-os/wiki-path";
import { api } from "~/trpc/server";
import { redirectToRandomPage } from "../../../_lib/random-page";
import { orNotFound } from "../_lib/or-not-found";

/** `Special:AllPages` and `Special:PrefixIndex` list this many pages at a time. */
const LIST_SIZE = 200;

type ListAction = Extract<SpecialAction, { type: "list-pages" }>;

/**
 * `url` as `redirect()` wants it. Next adds the base path to a site-relative redirect itself, and the
 * image URLs WikiOS builds may already carry it (`withBasePath`), which would double it; a
 * protocol-relative URL would be taken for a path on this site.
 */
function redirectTarget(url: string): string {
  if (url.startsWith("//")) return `https:${url}`;
  const base = getBasePath();
  return base && url.startsWith(`${base}/`) ? url.slice(base.length) : url;
}

/** `Special:FilePath/<file>`: the file's own URL. */
async function filePath(file: string): Promise<never> {
  const info = await orNotFound(api.wikios.getFileInfo({ file }));
  if (!info) notFound();
  return redirect(redirectTarget(info.url));
}

async function pageList(action: ListAction) {
  const listing = await orNotFound(
    api.wikios.listPages({
      namespace: action.namespace,
      prefix: action.prefix,
      from: action.from,
      limit: LIST_SIZE,
    })
  );
  const isPrefix = action.mode === "prefix";
  const query: Record<string, string> = { namespace: String(action.namespace) };
  if (isPrefix) query.prefix = action.prefix;

  return (
    <WikiOSLayout title={isPrefix ? `Pages with the prefix “${action.prefix}”` : "All pages"}>
      <PageList
        {...listing}
        from={action.from}
        query={query}
        specialPath={isPrefix ? "Special:PrefixIndex" : "Special:AllPages"}
      />
    </WikiOSLayout>
  );
}

/** A `Special:` page: a tool WikiOS already has (a redirect), or a page the route answers itself. */
export function specialView({ action }: SpecialTarget) {
  switch (action.type) {
    case "redirect":
      return redirect(action.href);
    case "random":
      return redirectToRandomPage();
    case "file-path":
      return filePath(action.file);
    case "list-pages":
      return pageList(action);
    default:
      return notFound();
  }
}
