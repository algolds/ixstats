"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building,
  Coins,
  Crown,
  HomeSimple,
  Journal,
  Leaderboard,
  NavArrowLeft,
  StatsReport,
  Wallet,
} from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";
import { SegmentedControl } from "~/components/ui/segmented-control";
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
    title: "Charter & run companies",
    body: "Open My companies to charter a corporation in one of 12 sub-industries, draw central bank credit, queue expansion or R&D decisions, and pay dividends to shareholders.",
  },
  {
    title: "Tenders & sovereign treasuries",
    body: "Bid on B2G government procurement tenders and B2B supply contracts on the Tenders board. Nation owners manage their sovereign treasury, wealth fund and bond issuances in Treasury.",
  },
];

const SECTION_TITLES: Record<ExchangeSection, string> = {
  front: "Exchange",
  markets: "Markets",
  tenders: "Tenders",
  portfolio: "Portfolio",
  leaderboards: "Leaderboards",
  treasury: "Treasury",
  companies: "My companies",
};

const SECTION_SUBTITLES: Record<ExchangeSection, string> = {
  front: "Sovereign (₷) capital markets, equities, nation bonds and business press.",
  markets: "Browse and trade listed company shares, sovereign bonds and sector index funds.",
  tenders: "Government procurement tenders and corporate contracts open for bidding.",
  leaderboards: "Largest corporations by market cap, sovereign treasuries and investor portfolios.",
  portfolio: "Your Sovereign (₷) wallet, equity stakes, bond holdings, open orders and watchlist.",
  companies: "Charter corporations, manage capital, draw central bank credit and declare dividends.",
  treasury: "Manage your nation's Sovereign (₷) treasury, wealth fund, bond issuances and lending.",
};

const OBJECT_CONTEXT: Record<
  Exclude<ExchangeRoute["kind"], "section" | "unknown">,
  { title: string; subtitle: string }
> = {
  company: {
    title: "Corporate equity",
    subtitle: "Live share price, two-sided order book, governance & operating P&L.",
  },
  bond: {
    title: "Sovereign bond",
    subtitle: "Fixed-income coupon, yield to maturity, treasury backing & secondary listings.",
  },
  nation: {
    title: "Sovereign issuer",
    subtitle: "National treasury balance, credit rating, sovereign wealth fund & domiciled corporations.",
  },
  story: {
    title: "Business press dispatch",
    subtitle: "Market-moving filings, corporate announcements & economic dispatches.",
  },
};

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

/** Masthead and Chrome navigation console for the Exchange, matching MyLeague, MyClub, Onoma and Vault. */
export function ExchangeHeader({ realmId }: { realmId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const route = exchangeRouteOf(pathname);
  const overview = useRealmOverview(realmId);
  const walletBalance = overview.data?.wallet?.sovereigns;
  const hasNationInRealm = Boolean(
    overview.data?.nations?.some((n) => n.realmId === realmId)
  );

  const isSection = route.kind === "section";
  const isMarkets = isSection && route.section === "markets";
  const hasOwnPrimaryAction =
    !isSection ||
    route.section === "treasury" ||
    route.section === "companies" ||
    route.section === "tenders";

  const sectionTabs = [
    { value: "front" as const, label: "Overview", icon: <HomeSimple /> },
    { value: "markets" as const, label: "Markets", icon: <StatsReport /> },
    { value: "tenders" as const, label: "Tenders", icon: <Journal /> },
    { value: "leaderboards" as const, label: "Leaderboards", icon: <Leaderboard /> },
    { value: "portfolio" as const, label: "Portfolio", icon: <Wallet /> },
    { value: "companies" as const, label: "My companies", icon: <Building /> },
    ...(hasNationInRealm || (isSection && route.section === "treasury")
      ? [{ value: "treasury" as const, label: "Treasury", icon: <Crown /> }]
      : []),
  ];

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

  if (isSection) {
    return (
      <div className="space-y-3">
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

        <FacetMaterial layer="chrome" className="rounded-card p-1.5">
          <SegmentedControl
            asTabs
            activationMode="manual"
            scrollable
            fullWidth
            size="sm"
            aria-label="Exchange sections"
            value={route.section}
            onValueChange={(next) =>
              router.push(realmPath(EXCHANGE_PATHS[next as ExchangeSection], realmId))
            }
            options={sectionTabs}
            itemClassName="min-w-max"
          />
        </FacetMaterial>
      </div>
    );
  }

  const backHref =
    route.kind === "story"
      ? realmPath(EXCHANGE_PATHS.front, realmId)
      : realmPath(EXCHANGE_PATHS.markets, realmId);
  const backLabel = route.kind === "story" ? "Overview" : "Markets";
  const contextMeta =
    route.kind !== "unknown"
      ? OBJECT_CONTEXT[route.kind]
      : { title: "Exchange", subtitle: "Sovereign (₷) capital markets" };

  return (
    <div className="space-y-3 pt-12 lg:pt-14">
      <FacetMaterial layer="chrome" className="rounded-card p-2">
        <div className="flex flex-col justify-between gap-2 px-1 py-0.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link href={backHref}>
                <NavArrowLeft aria-hidden />
                <span>Back to {backLabel}</span>
              </Link>
            </Button>
            <div className="border-separator flex min-w-0 flex-col border-l py-0.5 pl-3 select-none">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-headline text-label flex shrink-0 items-center gap-1.5">
                  <Coins className="text-tint size-4" aria-hidden="true" />
                  <span>{contextMeta.title}</span>
                </span>
                <span className="text-label-tertiary hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="text-footnote text-label-secondary hidden truncate md:inline">
                  {contextMeta.subtitle}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
        </div>
      </FacetMaterial>
    </div>
  );
}
