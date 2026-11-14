"use client";

import { useState } from "react";
import { Globe, Shield } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SearchField } from "~/components/ui/search-field";
import { Skeleton } from "~/components/ui/skeleton";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { CHARGE_CATEGORIES } from "~/lib/heraldry";
import { api, type RouterInputs } from "~/trpc/react";
import { BUILTIN_CHARGES } from "../builtin-charges";
import { ChargeGlyph } from "../ChargeGlyph";
import { useVexelEditor } from "../VexelEditorProvider";

type ChargeCategory = NonNullable<RouterInputs["heraldry"]["getChargeLibrary"]["category"]>;

interface ChargeLibraryPanelProps {
  onOpenCommons: () => void;
}

const TILE_GRID = "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6";

/** One charge to add: its drawing over its name. */
function ChargeTile({
  chargeId,
  name,
  svgData,
  onAdd,
}: {
  chargeId: string;
  name: string;
  svgData?: string | null;
  onAdd: (chargeId: string) => void;
}) {
  return (
    <Card
      interactive
      padding="sm"
      onClick={() => onAdd(chargeId)}
      aria-label={`Add ${name}`}
      className="flex min-w-0 flex-col items-center gap-2"
    >
      <ChargeGlyph chargeId={chargeId} svgData={svgData} className="text-tint" />
      <span className="text-caption text-label-secondary w-full truncate text-center">{name}</span>
    </Card>
  );
}

export default function ChargeLibraryPanel({ onOpenCommons }: ChargeLibraryPanelProps) {
  const { addCharge } = useVexelEditor();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const { data, isLoading } = api.heraldry.getChargeLibrary.useQuery({
    search: search || undefined,
    category: category ? (category as ChargeCategory) : undefined,
    limit: 30,
  });
  const imported = data?.items ?? [];
  const builtin = BUILTIN_CHARGES.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (chargeId: string) =>
    addCharge({ chargeId, position: "fess-point", count: 1, tincture: "or", size: 1.0 });

  return (
    <Card content="input" padding="md" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle icon={<Shield />}>Charge library</CardTitle>
        <Button variant="secondary" size="sm" onClick={onOpenCommons}>
          <Globe />
          Browse Commons
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <SearchField
          aria-label="Search charges"
          placeholder="Search charges"
          value={search}
          onValueChange={setSearch}
          containerClassName="min-w-48 flex-1"
        />
        <OptionSelect
          aria-label="Charge category"
          className="w-48"
          value={category}
          onValueChange={setCategory}
          options={[{ value: "", label: "All categories" }, ...CHARGE_CATEGORIES]}
        />
      </div>

      {builtin.length > 0 && (
        <section className="space-y-2" aria-labelledby="vexel-builtin-charges">
          <h3 id="vexel-builtin-charges" className="text-subhead text-label-secondary">
            Built in
          </h3>
          <div className={TILE_GRID}>
            {builtin.map((item) => (
              <ChargeTile key={item.id} chargeId={item.id} name={item.name} onAdd={handleAdd} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2" aria-labelledby="vexel-imported-charges">
        <h3 id="vexel-imported-charges" className="text-subhead text-label-secondary">
          Imported
        </h3>
        {isLoading ? (
          <div className={TILE_GRID} aria-busy="true" aria-label="Loading charges">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="rounded-row h-20" />
            ))}
          </div>
        ) : imported.length === 0 ? (
          <EmptyState
            compact
            title="No imported charges"
            message="Import charges from Wikimedia Commons to use them here."
          />
        ) : (
          <div className={TILE_GRID}>
            {imported.map((item) => (
              <ChargeTile
                key={item.id}
                chargeId={item.id}
                name={item.name}
                svgData={item.svgData}
                onAdd={handleAdd}
              />
            ))}
          </div>
        )}
      </section>
    </Card>
  );
}
