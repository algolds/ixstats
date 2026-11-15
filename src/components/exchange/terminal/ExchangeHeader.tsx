"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building, Coins, Crown, HomeSimple, StatsReport, Wallet } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  EXCHANGE_PATHS,
  exchangeRouteOf,
  type ExchangeRoute,
  type ExchangeSection,
} from "~/lib/exchange/routes";
import { ExchangeIconWell, formatSovereignFigure } from "./brand";
import { useRealmOverview, useTreasuryActor } from "./useTreasuryActor";

/**
 * Primary Exchange sections:
 * - `front` (Overview): Realm index, news dispatches, movers, nation bonds & leaderboards
 * - `markets` (Markets): Searchable equities, sovereign bonds & macro sector funds
 * - `portfolio` (Portfolio): Personal wallet, holdings, orders & watchlist
 * - `companies` (Companies): Corporate charters, operating controls & B2G/B2B tenders
 * - `treasury` (Treasury): Sovereign treasury desk, shown for nation owners
 */
export type PrimaryTab = "front" | "markets" | "portfolio" | "companies" | "treasury";

const EXCHANGE_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to the Exchange",
    body: "The Exchange is the Sovereign (₷) capital market. Every player starts with a ₷1,000 wallet to invest in company shares, nation bonds, sector index funds and corporate ventures.",
  },
  {
    title: "Trade equities, bonds & funds",
    body: "Open Markets to browse listed corporations, sovereign nation bonds and the 4 macro sector funds. Place instant fills or resting limit orders on the two-sided order book.",
  },
  {
    title: "Portfolio & sovereign treasury",
    body: "Open Portfolio to track your holdings, open orders and watchlist. Nation owners can switch directly to their Sovereign Treasury to manage their wealth fund, bond issuances and lending.",
  },
  {
    title: "Companies & tenders",
    body: "Open Companies to charter corporations, draw central bank credit, declare dividends, and bid on B2G government procurement tenders and B2B supply contracts.",
  },
];

const SECTION_TITLES: Record<ExchangeSection, string> = {
  front: "Exchange",
  markets: "Markets",
  tenders: "Companies & tenders",
  portfolio: "Portfolio",
  leaderboards: "Exchange",
  treasury: "Treasury",
  companies: "Companies & tenders",
};

const SECTION_SUBTITLES: Record<ExchangeSection, string> = {
  front: "Sovereign (₷) capital markets, equities, nation bonds, leaderboards and business press.",
  markets: "Browse and trade listed company shares, sovereign bonds and sector index funds.",
  tenders: "Charter corporations, manage operations and bid on government or corporate tenders.",
  leaderboards: "Largest corporations by market cap, sovereign treasuries and investor portfolios.",
  portfolio: "Your Sovereign (₷) wallet, holdings, open orders, watchlist and sovereign treasury.",
  companies: "Charter corporations, manage operations and bid on government or corporate tenders.",
  treasury: "Manage your nation's Sovereign (₷) treasury, wealth fund, bond issuances and lending.",
};

const OBJECT_CONTEXT: Record<
  Exclude<ExchangeRoute["kind"], "section" | "unknown">,
  { title: string; tab: PrimaryTab }
> = {
  company: { title: "Corporate equity", tab: "markets" },
  bond: { title: "Sovereign bond", tab: "markets" },
  nation: { title: "Sovereign issuer", tab: "markets" },
  story: { title: "Business press dispatch", tab: "front" },
};

export const TAB_LABELS: Record<PrimaryTab, string> = {
  front: "Overview",
  markets: "Markets",
  portfolio: "Portfolio",
  companies: "Companies",
  treasury: "Treasury",
};

export function primaryTabForRoute(route: ExchangeRoute, showTreasury: boolean): PrimaryTab {
  if (route.kind !== "section") {
    return route.kind !== "unknown" ? OBJECT_CONTEXT[route.kind].tab : "front";
  }
  switch (route.section) {
    case "front":
    case "leaderboards":
      return "front";
    case "markets":
      return "markets";
    case "portfolio":
      return "portfolio";
    case "treasury":
      return showTreasury ? "treasury" : "portfolio";
    case "companies":
    case "tenders":
      return "companies";
  }
}

function realmPath(path: string, realmId: string): string {
  return realmId && realmId !== DEFAULT_REALM_ID
    ? `${path}?realm=${encodeURIComponent(realmId)}`
    : path;
}

function searchHref(realmId: string): string {
  const query = new URLSearchParams({ focus: "search" });
  if (realmId && realmId !== DEFAULT_REALM_ID) query.set("realm", realmId);
  return `${EXCHANGE_PATHS.markets}?${query.toString()}`;
}

/** Masthead and standard Facet segmented navigation for the Exchange. */
export function ExchangeHeader({ realmId, panelId }: { realmId: string; panelId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const route = exchangeRouteOf(pathname);
  const overview = useRealmOverview(realmId);
  const treasury = useTreasuryActor(realmId);
  const walletBalance = overview.data?.wallet?.sovereigns;

  const isSection = route.kind === "section";
  const isMarkets = isSection && route.section === "markets";
  const showTreasury = Boolean(treasury) || (isSection && route.section === "treasury");
  const hasOwnPrimaryAction =
    !isSection ||
    route.section === "treasury" ||
    route.section === "companies" ||
    route.section === "tenders";

  const activeTab = primaryTabForRoute(route, showTreasury);

  const options = [
    { value: "front" as const, label: TAB_LABELS.front, icon: <HomeSimple /> },
    { value: "markets" as const, label: TAB_LABELS.markets, icon: <StatsReport /> },
    { value: "portfolio" as const, label: TAB_LABELS.portfolio, icon: <Wallet /> },
    { value: "companies" as const, label: TAB_LABELS.companies, icon: <Building /> },
    ...(showTreasury
      ? [{ value: "treasury" as const, label: TAB_LABELS.treasury, icon: <Crown /> }]
      : []),
  ];

  const actions = (
    <>
      <HeroHelpModal title="Exchange guide" steps={EXCHANGE_HELP_STEPS} accentClass="text-tint" />
      {typeof walletBalance === "number" && (
        <Button asChild variant="secondary" size="sm">
          <Link
            href={realmPath(EXCHANGE_PATHS.portfolio, realmId)}
            title="Open your Exchange portfolio and wallet"
          >
            <Wallet className="text-tint" aria-hidden />
            <span className="tabular-nums">₷{formatSovereignFigure(walletBalance)}</span>
          </Link>
        </Button>
      )}
      {!isMarkets && (
        <Button asChild variant={hasOwnPrimaryAction ? "secondary" : "default"} size="sm">
          <Link href={searchHref(realmId)}>
            <StatsReport aria-hidden />
            <span>Buy or sell</span>
          </Link>
        </Button>
      )}
    </>
  );

  const backHref =
    route.kind === "story"
      ? realmPath(EXCHANGE_PATHS.front, realmId)
      : realmPath(EXCHANGE_PATHS.markets, realmId);
  const backLabel = route.kind === "story" ? "Overview" : "Markets";
  const contextMeta = !isSection && route.kind !== "unknown" ? OBJECT_CONTEXT[route.kind] : null;

  return (
    <div className="space-y-4">
      {isSection ? (
        <PageHeader
          bleed
          leading={
            <ExchangeIconWell size="lg">
              <Coins />
            </ExchangeIconWell>
          }
          title={SECTION_TITLES[route.section]}
          subtitle={SECTION_SUBTITLES[route.section]}
          actions={actions}
        />
      ) : (
        <PageHeader
          bleed
          title={contextMeta?.title ?? "Exchange"}
          back={{ href: backHref, label: backLabel }}
          collapseOn={null}
          actions={actions}
        />
      )}

      <SegmentedControl
        asTabs={Boolean(panelId)}
        activationMode="manual"
        scrollable
        itemClassName="min-w-max max-[24rem]:[&_svg]:hidden"
        aria-label="Exchange sections"
        value={activeTab}
        onValueChange={(next) => router.push(realmPath(EXCHANGE_PATHS[next], realmId))}
        getTabPanelId={panelId ? () => panelId : undefined}
        options={options}
        className="max-w-full"
      />
    </div>
  );
}
