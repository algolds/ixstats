"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building,
  Coins,
  HomeSimple,
  StatsReport,
  Wallet,
} from "iconoir-react";
import { DocumentRibbon, type RibbonTab } from "~/components/shared/document/DocumentRibbon";
import { PageHeader } from "~/components/shell/PageHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";
import { LensCard } from "~/components/ui/lens-card";
import { EXCHANGE_VERSION } from "~/lib/buildVersion";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  EXCHANGE_PATHS,
  exchangeRouteOf,
  type ExchangeRoute,
  type ExchangeSection,
} from "~/lib/exchange/routes";
import { ExchangeIconWell, Pill, formatSovereignFigure } from "./brand";
import { useRealmOverview } from "./useTreasuryActor";

/**
 * The 4 primary Exchange ribbon tabs (Apple Design restraint: max 4 items per navigation group).
 * - `front` (Overview): Realm index, news dispatches, movers, nation bonds & leaderboards
 * - `markets` (Markets): Searchable equities, sovereign bonds & macro sector funds
 * - `portfolio` (Portfolio): Personal wallet, holdings, orders, watchlist & sovereign treasury desk
 * - `companies` (Companies): Corporate charters, operating controls & B2G/B2B tenders
 */
type PrimaryTab = "front" | "markets" | "portfolio" | "companies";

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
  treasury: "Portfolio & treasury",
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
  { title: string; subtitle: string; tab: PrimaryTab }
> = {
  company: {
    title: "Corporate equity",
    subtitle: "Live share price, two-sided order book, governance & operating P&L.",
    tab: "markets",
  },
  bond: {
    title: "Sovereign bond",
    subtitle: "Fixed-income coupon, yield to maturity, treasury backing & secondary listings.",
    tab: "markets",
  },
  nation: {
    title: "Sovereign issuer",
    subtitle: "National treasury balance, credit rating, sovereign wealth fund & domiciled corporations.",
    tab: "markets",
  },
  story: {
    title: "Business press dispatch",
    subtitle: "Market-moving filings, corporate announcements & economic dispatches.",
    tab: "front",
  },
};

function primaryTabForSection(section: ExchangeSection): PrimaryTab {
  switch (section) {
    case "front":
    case "leaderboards":
      return "front";
    case "markets":
      return "markets";
    case "portfolio":
    case "treasury":
      return "portfolio";
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

function SearchHref(realmId: string): string {
  const query = new URLSearchParams({ focus: "search" });
  if (realmId && realmId !== DEFAULT_REALM_ID) query.set("realm", realmId);
  return `${EXCHANGE_PATHS.markets}?${query.toString()}`;
}

const PRIMARY_TABS: readonly RibbonTab<PrimaryTab>[] = [
  { id: "front", label: "Overview", icon: HomeSimple },
  { id: "markets", label: "Markets", icon: StatsReport },
  { id: "portfolio", label: "Portfolio", icon: Wallet },
  { id: "companies", label: "Companies", icon: Building },
];

/** Masthead and 4-tab Facet Lens ribbon console for the Exchange. */
export function ExchangeHeader({ realmId }: { realmId: string }) {
  const ribbonId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const route = exchangeRouteOf(pathname);
  const overview = useRealmOverview(realmId);
  const walletBalance = overview.data?.wallet?.sovereigns;
  const activeCompaniesCount =
    overview.data?.companies?.filter((c) => c.status !== "DISSOLVED").length ?? 0;

  const isSection = route.kind === "section";
  const isMarkets = isSection && route.section === "markets";
  const hasOwnPrimaryAction =
    !isSection ||
    route.section === "treasury" ||
    route.section === "companies" ||
    route.section === "tenders";

  const activeTab: PrimaryTab = isSection
    ? primaryTabForSection(route.section)
    : route.kind !== "unknown"
      ? OBJECT_CONTEXT[route.kind].tab
      : "front";

  const actions = (
    <>
      <HeroHelpModal
        title="Exchange guide"
        steps={EXCHANGE_HELP_STEPS}
        accentClass="text-tint"
      />
      {typeof walletBalance === "number" && (
        <Button asChild variant="secondary" size="sm">
          <Link
            href={realmPath(EXCHANGE_PATHS.portfolio, realmId)}
            title="Open your Exchange portfolio and wallet"
          >
            <Wallet className="text-tint" />
            <span className="tabular-nums">₷{formatSovereignFigure(walletBalance)}</span>
          </Link>
        </Button>
      )}
      {!isMarkets && (
        <Pill tone={hasOwnPrimaryAction ? "plain" : "tint"} asChild>
          <Link href={SearchHref(realmId)}>
            <StatsReport />
            <span>Buy or sell</span>
          </Link>
        </Pill>
      )}
    </>
  );

  const backHref =
    route.kind === "story"
      ? realmPath(EXCHANGE_PATHS.front, realmId)
      : realmPath(EXCHANGE_PATHS.markets, realmId);
  const backLabel = route.kind === "story" ? "Overview" : "Markets";
  const contextMeta =
    !isSection && route.kind !== "unknown"
      ? OBJECT_CONTEXT[route.kind]
      : null;

  return (
    <div className="space-y-3">
      {isSection ? (
        <PageHeader
          bleed
          leading={
            <ExchangeIconWell size="lg">
              <Coins />
            </ExchangeIconWell>
          }
          title={SECTION_TITLES[route.section]}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{SECTION_SUBTITLES[route.section]}</span>
              <span className="text-label-tertiary" aria-hidden="true">
                ·
              </span>
              <span className="text-caption text-label-tertiary font-mono tabular-nums">
                v{EXCHANGE_VERSION}
              </span>
            </span>
          }
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

      <LensCard app="exchange" padding="none" className="overflow-hidden [&>*]:border-y-0">
        <DocumentRibbon
          idBase={ribbonId}
          label="Exchange sections"
          tabs={PRIMARY_TABS}
          activeTab={activeTab}
          counts={activeCompaniesCount > 0 ? { companies: activeCompaniesCount } : undefined}
          onSelectTab={(next) =>
            router.push(realmPath(EXCHANGE_PATHS[next], realmId))
          }
          actions={
            contextMeta ? (
              <Badge variant="outline" className="hidden sm:inline-flex">
                {contextMeta.title}
              </Badge>
            ) : undefined
          }
        />
      </LensCard>
    </div>
  );
}
