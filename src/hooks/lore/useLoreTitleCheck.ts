import { useDebounce } from "~/hooks/useDebounce";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { api } from "~/trpc/react";

/** How long the title stays still before it is checked against the wiki. */
const CHECK_DELAY_MS = 350;

export type LoreTitleCheck =
  | { status: "empty" | "invalid" | "checking" | "failed" }
  | { status: "free"; title: string }
  | { status: "exists"; title: string; resolvedTitle: string };

/** An article title a lore piece can have: valid on the wiki, in the main namespace, with no section. */
function articleTitle(raw: string): string | null {
  const canonical = canonicalizeTitle(raw);
  return canonical?.namespaceId === 0 && canonical.fragment === null ? canonical.title : null;
}

/**
 * The lore writer's live title check: whether the typed title can name a new piece (free), names a page that is there
 * already (exists, with the title it leads to), or cannot be a piece's title at all.
 */
export function useLoreTitleCheck(raw: string): LoreTitleCheck {
  const typed = articleTitle(raw.trim());
  const settled = useDebounce(typed, CHECK_DELAY_MS);
  const query = api.wikios.checkPageExists.useQuery(
    { title: settled ?? "" },
    { enabled: settled !== null, staleTime: 0, retry: false }
  );

  if (!raw.trim()) return { status: "empty" };
  if (typed === null) return { status: "invalid" };
  if (settled !== typed || query.isFetching) return { status: "checking" };
  if (query.isError) return { status: "failed" };
  if (!query.data) return { status: "checking" };
  return query.data.exists
    ? { status: "exists", title: typed, resolvedTitle: query.data.resolvedTitle }
    : { status: "free", title: typed };
}
