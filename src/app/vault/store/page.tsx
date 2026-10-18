import type { Metadata } from "next";
import type { PageQuery } from "~/lib/thinkpages-forum/links";
import { VaultStoreTab } from "~/components/vault/sections/marketplace/VaultStoreTab";

export const metadata: Metadata = { title: "Store - IxStates" };

/**
 * The Store keeps packs, cosmetics and upgrades; auctions and trading moved into the cards hub's Market. Old
 * `?tab=auctions|trading` links never reach this page: `src/proxy.ts` sends them on with a 308, since a redirect
 * thrown here would stream as a 200 under the Vault's loading boundary.
 */
export default async function VaultStorePage({
  searchParams,
}: {
  searchParams: Promise<PageQuery>;
}) {
  const { view } = await searchParams;
  return (
    // pt-14: the shop's tabs are the first row and the page has no header toolbar, so it clears Halo's floating band.
    <div className="pt-14">
      <h1 className="sr-only">Store</h1>
      <VaultStoreTab initialView={(Array.isArray(view) ? view[0] : view) ?? null} />
    </div>
  );
}
