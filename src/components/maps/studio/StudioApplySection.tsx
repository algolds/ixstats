"use client";

import { useState } from "react";
import { ValueSelect } from "~/components/ui/value-select";
import type { PhysicalLayer } from "~/lib/maps/import/options";
import { applyBlock } from "~/lib/worldgen/studio-apply";
import { useStudio } from "./StudioContext";
import { StudioLayerChoice } from "./StudioLayerChoice";
import { StudioRealmApply } from "./StudioRealmApply";

/**
 * Apply to a realm. A preset world goes to any realm but Ixnay through the founder's flow. A world fitted to a realm's
 * map goes to that realm, with a layer choice (required for Ixnay, optional for the others). The server checks it all
 * again.
 */
export function StudioApplySection() {
  const { source, realms, realmsState } = useStudio();
  const fitting = source.kind === "fit";
  const [picked, setPicked] = useState<string | null>(null);
  const [layers, setLayers] = useState<PhysicalLayer[]>([]);
  const wanted = fitting ? source.realm : picked;
  const target = realms.find((realm) => realm.slug === wanted) ?? null;
  const chosen = fitting ? layers : [];
  const block = applyBlock({ sourceKind: source.kind, target, layers: chosen });

  return (
    <section aria-label="Apply to a realm" className="space-y-3">
      <h4 className="text-headline">Apply to a realm</h4>
      {fitting ? (
        <>
          <p className="text-label-secondary text-caption">
            {target
              ? `This world is fitted to ${target.name}, so it can only go to ${target.name}.`
              : "This world is fitted to a realm's map, so it can only go to that realm."}
          </p>
          <StudioLayerChoice
            value={layers}
            onChange={setLayers}
            required={target?.isIxnay === true}
          />
        </>
      ) : (
        <ValueSelect
          aria-label="Realm to apply to"
          size="sm"
          value={picked ?? undefined}
          placeholder="Choose a realm"
          options={realms.map((realm): [string, string] => [realm.slug, realm.name])}
          onValueChange={setPicked}
          disabled={realmsState !== "ready"}
        />
      )}
      {realmsState === "failed" && (
        <p role="alert" className="text-destructive text-caption">
          The realms could not be read.
        </p>
      )}
      {block ? (
        <p className="text-label-secondary text-caption">{block}</p>
      ) : (
        target && (
          <StudioRealmApply
            // A new realm starts the flow over; a new layer choice only marks a check out of date
            key={`${target.id}:${source.kind}`}
            realm={{ id: target.id, slug: target.slug }}
            source={fitting ? "realm-map" : "preset"}
            layers={chosen.length > 0 ? chosen : undefined}
          />
        )
      )}
    </section>
  );
}
