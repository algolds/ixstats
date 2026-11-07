"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { EmptyState } from "~/components/ui/empty-state";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { exchangeRouteOf, type ExchangeRoute } from "~/lib/exchange/routes";
import { ExchangeHeader } from "./ExchangeHeader";
import { CompanyPage } from "./CompanyPage";
import { FrontPage } from "./FrontPage";
import { LeaderboardsPage } from "./LeaderboardsPage";
import { MarketsPage } from "./MarketsPage";

/** The page for one Exchange address. */
function ExchangePage({ route, realmId }: { route: ExchangeRoute; realmId: string }) {
  if (route.kind === "section") {
    if (route.section === "front") return <FrontPage realmId={realmId} />;
    if (route.section === "markets") return <MarketsPage realmId={realmId} />;
    if (route.section === "leaderboards") return <LeaderboardsPage realmId={realmId} />;
  }
  if (route.kind === "company") return <CompanyPage companyId={route.id} />;
  if (route.kind === "unknown") {
    return <EmptyState title="Nothing here" message="This Exchange address doesn't exist." />;
  }
  return <EmptyState title="Coming up" message="This part of the Exchange is being built." />;
}

/**
 * The Exchange's one router (single-page pattern, as MyCountry and the cards hub): the page comes from the path and
 * the realm from `?realm=` (else the viewer's own realm), so a sidebar click or the back button changes it without a
 * route transition.
 */
export function ExchangeRouter() {
  const route = exchangeRouteOf(usePathname());
  const viewerRealm = useViewerRealmId();
  const realmId = useSearchParams().get("realm") ?? viewerRealm ?? DEFAULT_REALM_ID;
  return (
    <>
      <ExchangeHeader realmId={realmId} />
      <ExchangePage route={route} realmId={realmId} />
    </>
  );
}
