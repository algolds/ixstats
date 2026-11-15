"use client";

import { Component, Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { CardTitle } from "~/components/ui/card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { LensCard } from "~/components/ui/lens-card";
import { DIVISIONS, ORDINARIES, SHIELD_SHAPES } from "~/lib/heraldry";
import { useVexelEditor } from "../VexelEditorProvider";
import { chargeName } from "../builtin-charges";

const labelOf = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

/** The design's layers as a tree: picking a row opens its properties below. */
export default function LayerPanel() {
  const { composition, selectedLayerPath, selectLayer, addOrdinary } = useVexelEditor();
  const ordinaries = composition.shield.ordinaries ?? [];
  const charges = composition.shield.charges ?? [];

  const row = (path: string, title: string, subtitle?: string) => (
    <FacetRow
      key={path}
      title={title}
      subtitle={subtitle}
      selected={selectedLayerPath === path}
      selectionStyle="tint"
      onClick={() => selectLayer(selectedLayerPath === path ? null : path)}
    />
  );

  return (
    <LensCard padding="md" className="space-y-4">
      <CardTitle icon={<Component />}>Layers</CardTitle>
      <FacetList variant="plain">
        <FacetListSection header="Shield">
          {row("shield", "Shield", labelOf(SHIELD_SHAPES, composition.shield.shape))}
          {row("shield.field", "Field", labelOf(DIVISIONS, composition.shield.field.division))}
        </FacetListSection>

        <FacetListSection
          header={
            <span className="flex items-center justify-between gap-2">
              Ordinaries
              <Button
                variant="ghost"
                size="xs"
                onClick={() =>
                  addOrdinary({ type: "chief", tincture: "or", lineStyle: "straight" })
                }
              >
                <Plus />
                Add
              </Button>
            </span>
          }
          footer={ordinaries.length === 0 ? "None yet." : undefined}
        >
          {ordinaries.map((ord, idx) =>
            row(`shield.ordinaries[${idx}]`, labelOf(ORDINARIES, ord.type))
          )}
        </FacetListSection>

        <FacetListSection
          header="Charges"
          footer={charges.length === 0 ? "None yet. Add one from the charge library." : undefined}
        >
          {charges.map((charge, idx) =>
            row(
              `shield.charges[${idx}]`,
              chargeName(charge.chargeId),
              charge.count > 1 ? `${charge.count} of them` : undefined
            )
          )}
        </FacetListSection>

        <FacetListSection header="Ornaments">{row("externals", "Helm and motto")}</FacetListSection>
      </FacetList>
    </LensCard>
  );
}
