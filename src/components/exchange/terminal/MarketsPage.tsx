"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { Building, Coins, StatsReport } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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
import { ChangeLabel, ExchangeIconWell, Figure, formatSovereignFigure } from "./brand";
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

function hrefOf(row: MarketRow): string | null {
  if (row.kind === "companies") return companyHref(row.id);
  if (row.kind === "bonds") return bondHref(row.id);
  return null;
}

function RowDetail({ row }: { row: MarketRow }) {
  if (row.kind === "bonds") {
    return (
      <span className="text-footnote text-label-secondary tabular-nums">
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
  const wellContent =
    row.kind === "companies" ? (
      <Building />
    ) : row.kind === "bonds" ? (
      <Coins />
    ) : (
      <StatsReport />
    );
  const name = (
    <span className="flex min-w-0 items-center gap-3">
      <ExchangeIconWell size="md">{wellContent}</ExchangeIconWell>
      <span className="min-w-0">
        <span className="text-body text-label block truncate font-semibold">
          {row.kind === "companies" && (
            <span className="text-tint mr-2 tabular-nums">{row.ticker}</span>
          )}
          {row.name}
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
          className="hover:bg-fill-4 active:bg-fill-3 focus-visible:outline-tint rounded-control duration-fast ease-out-facet -mx-2 flex items-center gap-3 px-2 py-2.5 transition-colors focus-visible:outline-2 pointer-coarse:min-h-11"
        >
          <span className="min-w-0 flex-1">{name}</span>
          <span className="flex flex-col items-end">
            <Figure value={`₷${formatSovereignFigure(row.price)}`} />
            <RowDetail row={row} />
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
  return (
    <div className="space-y-4">
      <Card content="data" padding="lg" className="space-y-4">
        <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-4">
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
        ) : (markets.data ?? []).length === 0 ? (
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
            {(markets.data ?? []).map((row) => (
              <MarketRowItem
                key={`${row.kind}:${row.id}`}
                row={row}
                realmId={realmId}
                treasury={treasury}
              />
            ))}
          </ul>
        )}
      </Card>
      {kind === "funds" && canManageRealm && <SectorLevers realmId={realmId} />}
    </div>
  );
}
