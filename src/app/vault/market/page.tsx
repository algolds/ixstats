import { redirect } from "next/navigation";
import { withQuery, type PageQuery } from "~/lib/thinkpages-forum/links";

interface VaultMarketPageRedirectProps {
  searchParams: Promise<PageQuery>;
}

/** The old address opens the Auctions tab of the Store; the query it came with carries over, and this page's tab wins. */
export default async function VaultMarketPage({ searchParams }: VaultMarketPageRedirectProps) {
  redirect(withQuery("/vault/store", { ...(await searchParams), tab: "auctions" }));
}
