"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { EmptyState } from "~/components/ui/empty-state";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { exchangeRouteOf, type ExchangeRoute, type ExchangeSection } from "~/lib/exchange/routes";
import { ExchangeHeader } from "./ExchangeHeader";
import { BondPage } from "./BondPage";
import { CompanyPage } from "./CompanyPage";
import { MyCompaniesPage, TendersPage } from "./DeskPages";
import { FrontPage } from "./FrontPage";
import { LeaderboardsPage } from "./LeaderboardsPage";
import { MarketsPage } from "./MarketsPage";
import { NationPage } from "./NationPage";
import { PortfolioPage } from "./PortfolioPage";
import { StoryPage } from "./StoryPage";
import { TreasuryPage } from "./TreasuryPage";

const SECTION_PAGES: Record<ExchangeSection, (props: { realmId: string }) => React.ReactNode> = {
  front: FrontPage,
  markets: MarketsPage,
  tenders: TendersPage,
  portfolio: PortfolioPage,
  leaderboards: LeaderboardsPage,
  treasury: TreasuryPage,
  companies: MyCompaniesPage,
};

/** The page for one Exchange address. */
function ExchangePage({ route, realmId }: { route: ExchangeRoute; realmId: string }) {
  switch (route.kind) {
    case "section": {
      const Page = SECTION_PAGES[route.section];
      return <Page realmId={realmId} />;
    }
    case "company":
      return <CompanyPage companyId={route.id} />;
    case "bond":
      return <BondPage bondId={route.id} />;
    case "nation":
      return <NationPage countryId={route.id} />;
    case "story":
      return <StoryPage newsId={route.id} />;
    default:
      return <EmptyState title="Nothing here" message="This Exchange address doesn't exist." />;
  }
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
