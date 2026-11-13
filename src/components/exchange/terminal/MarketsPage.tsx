"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { Building, Coins, Cpu, StatsReport } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { LensCard } from "~/components/ui/lens-card";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import {
  MARKET_KINDS,
  bondHref,
  companyHref,
  marketKindOf,
  type MarketKind,
} from "~/lib/exchange/routes";
import type { MarketRow } from "~/lib/exchange/terminal";
import { CreditRatingBadge } from "../shared";
import {
  ChangeLabel,
  ExchangeIconWell,
  Figure,
  TickerTile,
  formatSovereignFigure,
  symbolOf,
  toneOf,
} from "./brand";
import { TradeButton } from "./TradeSheet";
import { SectorLevers } from "./SectorLevers";
import { useRealmOverview, useTreasuryActor } from "./useTreasuryActor";

const KIND_LABELS: Record<MarketKind, string> = {
  companies: "Companies",
  bonds: "Bonds",
  funds: "Funds",
};
const KIND_ICONS: Record<MarketKind, React.ReactNode> = {
  companies: <Building />,
  bonds: <Coins />,
  funds: <StatsReport />,
};
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function sectorFundIcon(sectorKey: string) {
  if (sectorKey === "finance") return <Coins />;
  if (sectorKey === "industry") return <Building />;
  if (sectorKey === "technology") return <Cpu />;
  return <StatsReport />;
}

function hrefOf(row: MarketRow): string | null {
  if (row.kind === "companies") return companyHref(row.id);
  if (row.kind === "bonds") return bondHref(row.id);
  return null;
}

function RowDetail({ row }: { row: MarketRow }) {
  if (row.kind === "bonds") {
    return (
      <span className="text-footnote text-label-secondary font-mono tabular-nums">
        {pct(row.yield)} · {row.rating}
      </span>
    );
  }
  if (row.kind === "companies") {
    return (
      <span className="text-footnote tabular-nums">
        <ChangeLabel pct={row.changePct} />{" "}
        <span className="text-label-secondary">· {row.rating}</span>
      </span>
    );
  }
  return <span className="text-footnote text-label-secondary">Unit price</span>;
}

function MarketRowLeading({ row }: { row: MarketRow }) {
  if (row.kind === "companies") {
    const tone =
      toneOf(row.changePct) === "gain"
        ? "gain"
        : toneOf(row.changePct) === "loss"
          ? "loss"
          : "tint";
    return <TickerTile code={symbolOf(row.name, row.ticker)} tone={tone} size="md" />;
  }
  if (row.kind === "bonds") {
    return <TickerTile code={`${row.weeksLeft}W`} tone="neutral" size="md" />;
  }
  return <ExchangeIconWell size="md">{sectorFundIcon(row.sectorKey)}</ExchangeIconWell>;
}

function MarketRowItem({
  row,
  realmId,
  treasury,
}: {
  row: MarketRow;
  realmId: string;
  treasury?: { countryId: string; name: string };
}) {
  const href = hrefOf(row);
  const name = (
    <span className="flex min-w-0 items-center gap-3">
      <MarketRowLeading row={row} />
      <span className="min-w-0">
        <span className="text-body text-label flex flex-wrap items-center gap-2 truncate font-semibold">
          <span>{row.name}</span>
          {row.kind === "bonds" && row.unitsLeft > 0 && (
            <Badge variant="outline" className="hidden font-mono tabular-nums sm:inline-flex">
              {row.unitsLeft} left
            </Badge>
          )}
        </span>
        <span className="text-footnote text-label-secondary block truncate">{row.subtitle}</span>
      </span>
    </span>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href}
          data-row
          className="facet-press facet-press-subtle hover:bg-fill-4 active:bg-fill-3 focus-visible:outline-tint rounded-control duration-fast ease-out-facet -mx-2.5 flex items-center gap-3 px-2.5 py-2.5 transition-colors focus-visible:outline-2 pointer-coarse:min-h-11"
        >
          <span className="min-w-0 flex-1">{name}</span>
          <span className="flex shrink-0 items-center gap-3">
            {(row.kind === "companies" || row.kind === "bonds") && (
              <span className="hidden sm:inline-flex">
                <CreditRatingBadge rating={row.rating} />
              </span>
            )}
            <span className="flex flex-col items-end">
              <Figure value={`₷${formatSovereignFigure(row.price)}`} />
              <RowDetail row={row} />
            </span>
          </span>
        </Link>
      ) : (
        <div
          data-row
          className="flex items-center gap-3 py-2.5 pointer-coarse:min-h-11"
        >
          <div className="min-w-0 flex-1">{name}</div>
          <div className="flex flex-col items-end">
            <Figure value={`₷${formatSovereignFigure(row.price)}`} />
            <RowDetail row={row} />
          </div>
          {row.kind === "funds" && (
            <TradeButton
              tone="plain"
              treasury={treasury}
              instrument={{
                kind: "fund",
                sectorKey: row.sectorKey,
                realmId,
                name: row.name,
                price: row.price,
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

/** Every instrument in the realm: companies, nation bonds and sector funds. */
export function MarketsPage({ realmId }: { realmId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = marketKindOf(params.get("kind"));
  const query = params.get("q") ?? "";
  // `null` follows the address; a string is text typed but not yet written to it.
  const [draft, setDraft] = useState<string | null>(null);
  const markets = api.exchange.markets.useQuery(
    { realmId, kind, query: query || undefined },
    { placeholderData: keepPreviousData }
  );
  const treasury = useTreasuryActor(realmId);
  const canManageRealm = useRealmOverview(realmId).data?.canManageRealm ?? false;
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (!next.has("kind")) next.set("kind", kind);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  // The debounce fires later than the render that scheduled it, so it reads the newest `update`
  // (current params and kind) instead of the one it closed over.
  const latestUpdate = useRef(update);
  useEffect(() => {
    latestUpdate.current = update;
  });
  useEffect(() => {
    if (draft === null) return;
    const timer = setTimeout(() => {
      latestUpdate.current("q", draft);
      setDraft(null);
    }, 250);
    return () => clearTimeout(timer);
  }, [draft]);

  const rows = markets.data ?? [];

  return (
    <div className="space-y-4">
      <LensCard app="exchange" content="data" padding="lg" className="space-y-4">
        <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <SegmentedControl
              size="sm"
              aria-label="Instruments"
              value={kind}
              onValueChange={(k) => update("kind", k)}
              options={MARKET_KINDS.map((k) => ({
                value: k,
                label: KIND_LABELS[k],
                icon: KIND_ICONS[k],
              }))}
            />
            {!markets.isLoading && (
              <Badge variant="secondary" className="font-mono tabular-nums">
                {rows.length} listed
              </Badge>
            )}
          </div>
          <SearchField
            className="w-full sm:w-72"
            placeholder={`Search ${KIND_LABELS[kind].toLowerCase()}`}
            value={draft ?? query}
            autoFocus={params.get("focus") === "search"}
            onValueChange={setDraft}
          />
        </div>
        {markets.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-between gap-3 py-4">
            <p className="text-footnote text-label-secondary">Nothing listed here yet.</p>
            {(draft ?? query) && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  update("q", "");
                }}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-separator divide-y">
            {rows.map((row) => (
              <MarketRowItem
                key={`${row.kind}:${row.id}`}
                row={row}
                realmId={realmId}
                treasury={treasury}
              />
            ))}
          </ul>
        )}
      </LensCard>
      {kind === "funds" && canManageRealm && <SectorLevers realmId={realmId} />}
    </div>
  );
}
