"use client";

import { useId } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { WarningCircle } from "iconoir-react";
import { LensSurface } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { LensCard } from "~/components/ui/lens-card";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { exchangeRouteOf, type ExchangeRoute, type ExchangeSection } from "~/lib/exchange/routes";
import { ExchangeHeader, TAB_LABELS, primaryTabForRoute } from "./ExchangeHeader";
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
import { useTreasuryActor } from "./useTreasuryActor";

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
      return (
        <LensCard app="exchange" padding="lg">
          <EmptyState
            compact
            icon={<WarningCircle />}
            title="Nothing here"
            message="This Exchange address does not exist."
          />
        </LensCard>
      );
  }
}

/**
 * The Exchange's one router (single-page pattern, as MyCountry and the cards hub): the page comes from the path and
 * the realm from `?realm=` (else the viewer's own realm), so a sidebar click or the back button changes it without a
 * route transition.
 */
export function ExchangeRouter() {
  const panelId = useId();
  const route = exchangeRouteOf(usePathname());
  const viewerRealm = useViewerRealmId();
  const realmId = useSearchParams().get("realm") ?? viewerRealm ?? DEFAULT_REALM_ID;
  const treasury = useTreasuryActor(realmId);
  const showTreasury =
    Boolean(treasury) || (route.kind === "section" && route.section === "treasury");
  const activeTab = primaryTabForRoute(route, showTreasury);

  return (
    <LensSurface>
      <div className="space-y-4">
        <ExchangeHeader realmId={realmId} panelId={panelId} />
        <div role="tabpanel" id={panelId} aria-label={TAB_LABELS[activeTab]}>
          <ExchangePage route={route} realmId={realmId} />
        </div>
      </div>
    </LensSurface>
  );
}
