import { redirect } from "next/navigation";
import { withQuery, type PageQuery } from "~/lib/thinkpages-forum/links";

interface VaultMarketplaceRedirectProps {
  searchParams: Promise<PageQuery>;
}

/** The marketplace is the Store now; the Store, Auctions and Trading `?tab=` values carry over. */
export default async function VaultMarketplacePage({
  searchParams,
}: VaultMarketplaceRedirectProps) {
  redirect(withQuery("/vault/store", await searchParams));
}
