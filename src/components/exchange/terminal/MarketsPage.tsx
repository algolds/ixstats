"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
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
import { ChangeLabel, Figure, formatSovereignFigure } from "./brand";
import { TradeButton } from "./TradeSheet";

const KIND_LABELS: Record<MarketKind, string> = {
  companies: "Companies",
  bonds: "Bonds",
  funds: "Funds",
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

function MarketRowItem({ row, realmId }: { row: MarketRow; realmId: string }) {
  const href = hrefOf(row);
  const name = (
    <span className="min-w-0">
      <span className="text-body text-label block truncate font-semibold">
        {row.kind === "companies" && (
          <span className="text-tint mr-2 tabular-nums">{row.ticker}</span>
        )}
        {row.name}
      </span>
      <span className="text-footnote text-label-secondary block truncate">{row.subtitle}</span>
    </span>
  );
  return (
    <li className="flex items-center gap-3 py-3">
      {href ? (
        <Link href={href} className="hover:text-tint min-w-0 flex-1">
          {name}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{name}</div>
      )}
      <div className="flex flex-col items-end">
        <Figure value={`₷${formatSovereignFigure(row.price)}`} />
        <RowDetail row={row} />
      </div>
      {row.kind === "funds" && (
        <TradeButton
          instrument={{
            kind: "fund",
            sectorKey: row.sectorKey,
            realmId,
            name: row.name,
            price: row.price,
          }}
        />
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
  const markets = api.exchange.markets.useQuery({ realmId, kind, query: query || undefined });
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (!next.has("kind")) next.set("kind", kind);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  return (
    <Card content="data" padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          size="sm"
          aria-label="Instruments"
          value={kind}
          onValueChange={(k) => update("kind", k)}
          options={MARKET_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
        />
        <SearchField
          className="w-full sm:w-64"
          placeholder={`Search ${KIND_LABELS[kind].toLowerCase()}`}
          value={query}
          autoFocus={params.get("focus") === "search"}
          onValueChange={(v) => update("q", v)}
        />
      </div>
      {markets.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (markets.data ?? []).length === 0 ? (
        <p className="text-footnote text-label-secondary">Nothing listed here yet.</p>
      ) : (
        <ul className="divide-separator divide-y">
          {(markets.data ?? []).map((row) => (
            <MarketRowItem key={`${row.kind}:${row.id}`} row={row} realmId={realmId} />
          ))}
        </ul>
      )}
    </Card>
  );
}
