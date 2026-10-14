import { redirect } from "next/navigation";
import { withQuery, type PageQuery } from "~/lib/thinkpages-forum/links";

interface VaultPacksPageRedirectProps {
  searchParams: Promise<PageQuery>;
}

/** The old address opens the Store tab of the Store; the query it came with carries over, and this page's tab wins. */
export default async function VaultPacksPage({ searchParams }: VaultPacksPageRedirectProps) {
  redirect(withQuery("/vault/store", { ...(await searchParams), tab: "store" }));
}
