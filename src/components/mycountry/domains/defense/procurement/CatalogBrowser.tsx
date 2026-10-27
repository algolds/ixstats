"use client";

import React, { useMemo, useState } from "react";
import { Cart } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { DOMAIN_LABELS, leadMonths, type BranchDomain } from "~/lib/military/model";
import { designYearOf, fitsDomain } from "~/lib/military/defense-console";
import type { EquipmentPreset } from "~/lib/military/player-catalog";

/** Items rendered at once; a search narrows the rest. */
const PAGE = 40;

interface CatalogBrowserProps {
  equipment: readonly EquipmentPreset[];
  /** Domains the nation has branches in: only equipment one of them can hold is listed. */
  domains: readonly BranchDomain[];
  accessibleYear: number;
  canEdit: boolean;
  isLoading: boolean;
  onOrder: (item: EquipmentPreset) => void;
}

/** The catalog by domain: cost, design year, lead time, and whether domestic industry can build it. */
export function CatalogBrowser({ equipment, domains, accessibleYear, canEdit, isLoading, onOrder }: CatalogBrowserProps) {
  const [domain, setDomain] = useState<BranchDomain | "all">("all");
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const wanted = domain === "all" ? domains : [domain];
    return equipment.filter(
      (item) =>
        wanted.some((d) => fitsDomain(item.catalogCategory, d)) &&
        (!q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
    );
  }, [equipment, domains, domain, query]);

  return (
    <Card content="data">
      <CardHeader className="space-y-3 p-5 pb-3">
        <CardTitle icon={<Cart />}>Equipment catalog</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          {domains.length > 1 && (
            <SegmentedControl<BranchDomain | "all">
              aria-label="Domain"
              size="sm"
              value={domain}
              onValueChange={setDomain}
              options={[
                { value: "all", label: "All" },
                ...domains.map((d) => ({ value: d, label: DOMAIN_LABELS[d] })),
              ]}
            />
          )}
          <SearchField
            aria-label="Search the catalog"
            placeholder="Search by name or type"
            value={query}
            onValueChange={setQuery}
            className="min-w-48 flex-1"
          />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {isLoading ? (
          <p className="text-label-secondary text-callout">Loading the catalog…</p>
        ) : matches.length === 0 ? (
          <p className="text-label-secondary text-callout">Nothing in the catalog matches. Try another search.</p>
        ) : (
          <ul className="divide-separator divide-y">
            {matches.slice(0, PAGE).map((item) => (
              <CatalogRow
                key={item.key}
                item={item}
                accessibleYear={accessibleYear}
                canEdit={canEdit}
                onOrder={() => onOrder(item)}
              />
            ))}
          </ul>
        )}
        {matches.length > PAGE && (
          <p className="text-label-secondary text-footnote mt-2">
            Showing {PAGE} of {matches.length}. Search to narrow the list.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CatalogRow({
  item,
  accessibleYear,
  canEdit,
  onOrder,
}: {
  item: EquipmentPreset;
  accessibleYear: number;
  canEdit: boolean;
  onOrder: () => void;
}) {
  const designYear = designYearOf(item.era);
  const importOnly = designYear > accessibleYear;
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-callout text-label font-medium">{item.name}</span>
          {importOnly && <Badge variant="warning">Import only</Badge>}
        </div>
        <div className="text-label-secondary text-footnote tabular-nums">
          {item.category} · designed {designYear} · {formatCompactCurrency(item.acquisitionCost ?? 0)} each ·{" "}
          {leadMonths(item.subcategory, "domestic")} months to build
        </div>
      </div>
      {canEdit && (
        <Button size="sm" variant="outline" onClick={onOrder} aria-label={`Order ${item.name}`}>
          Order
        </Button>
      )}
    </li>
  );
}
