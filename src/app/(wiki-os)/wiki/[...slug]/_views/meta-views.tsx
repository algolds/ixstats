import "server-only";

import { notFound, permanentRedirect } from "next/navigation";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { PageHistoryView } from "~/components/wiki-os/history/PageHistoryView";
import { RevisionDiffView } from "~/components/wiki-os/history/RevisionDiffView";
import { PageInfoTable } from "~/components/wiki-os/reader/PageInfoTable";
import { RevisionView } from "~/components/wiki-os/reader/RevisionView";
import { diffNeedsHistory, resolveDiffRefs, type DiffSpec } from "~/lib/wiki-os/diff-refs";
import { canonicalizeTitle, type CanonicalTitle } from "~/lib/wiki-os/core/title";
import { articleHref } from "~/lib/wiki-os/wiki-path";
import { HydrateClient, api } from "~/trpc/server";
import { loadRevision } from "../_lib/load-revision";
import { orNotFound } from "../_lib/or-not-found";

/** Revisions the diff view looks through to find the one "after" another, or the newest. */
const HISTORY_WINDOW = 100;

/** `?action=history`: the page's revisions, in place. */
export function historyView(canon: CanonicalTitle) {
  return <PageHistoryView title={canon.title} slug={canon.urlPath} />;
}

/** `?action=info`: the page information table. */
export async function infoView(canon: CanonicalTitle) {
  const info = await orNotFound(api.wikios.getPageInfo({ title: canon.title }));
  return (
    <WikiOSLayout title={`Information for ${info.title}`}>
      <PageInfoTable info={info} />
    </WikiOSLayout>
  );
}

/** `?diff=`: the diff view in place, with `next` and `cur` worked out from the page's history. */
export async function diffView(canon: CanonicalTitle, spec: DiffSpec) {
  const history = diffNeedsHistory(spec)
    ? (
        await orNotFound(api.wikios.getHistory({ title: canon.title, limit: HISTORY_WINDOW }))
      ).revisions.map((revision) => revision.revid)
    : [];
  const revisions = resolveDiffRefs(spec, history);
  if (!revisions) notFound();

  return (
    <RevisionDiffView
      fromrev={revisions.fromrev}
      torev={revisions.torev}
      backHref={`/wiki/${canon.urlPath}`}
      backLabel={`Back to ${canon.title}`}
    />
  );
}

/**
 * `?oldid=<ref>`: one old revision. The revision decides which page it belongs to: a URL that names
 * another page moves to that page (MediaWiki shows the revision under its own title).
 */
export async function revisionView(canon: CanonicalTitle, ref: string) {
  const loaded = await loadRevision(ref);
  if (loaded.status === "missing" || loaded.status === "text-unavailable") notFound();

  const owner = loaded.status === "found" ? canonicalizeTitle(loaded.data.title) : null;
  if (owner && owner.title !== canon.title) {
    permanentRedirect(articleHref(owner, { oldid: ref }));
  }
  return (
    <HydrateClient>
      <RevisionView revisionRef={ref} title={canon.title} />
    </HydrateClient>
  );
}
