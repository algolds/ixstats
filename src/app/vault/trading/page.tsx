import { redirect } from "next/navigation";
import { withQuery, type PageQuery } from "~/lib/thinkpages-forum/links";

interface VaultTradingPageRedirectProps {
  searchParams: Promise<PageQuery>;
}

/** The old address opens the Trading tab of the Store; the query it came with carries over, and this page's tab wins. */
export default async function VaultTradingPage({ searchParams }: VaultTradingPageRedirectProps) {
  redirect(withQuery("/vault/store", { ...(await searchParams), tab: "trading" }));
}
