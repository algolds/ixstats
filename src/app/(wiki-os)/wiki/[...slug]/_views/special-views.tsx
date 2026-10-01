import "server-only";

import { notFound, redirect } from "next/navigation";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { PageList } from "~/components/wiki-os/reader/PageList";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import type { SpecialAction, SpecialTarget } from "~/lib/wiki-os/wiki-path";
import { api } from "~/trpc/server";

/** `Special:AllPages` and `Special:PrefixIndex` list this many pages at a time. */
const LIST_SIZE = 200;

type ListAction = Extract<SpecialAction, { type: "list-pages" }>;

/** `Special:Random`: a random published page, by a temporary redirect (the answer changes on every request). */
async function randomPage(): Promise<never> {
  const { title } = await api.wikios.getRandomPage();
  const canon = canonicalizeTitle(title ?? "");
  if (!canon) notFound();
  return redirect(`/wiki/${canon.urlPath}`);
}

/** `Special:FilePath/<file>`: the file's own URL. */
async function filePath(file: string): Promise<never> {
  const info = await api.wikios.getFileInfo({ file });
  if (!info) notFound();
  // A protocol-relative URL would be taken for a path on this site.
  return redirect(info.url.startsWith("//") ? `https:${info.url}` : info.url);
}

async function pageList(action: ListAction) {
  const listing = await api.wikios.listPages({
    namespace: action.namespace,
    prefix: action.prefix,
    from: action.from,
    limit: LIST_SIZE,
  });
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
      return randomPage();
    case "file-path":
      return filePath(action.file);
    case "list-pages":
      return pageList(action);
    default:
      return notFound();
  }
}
