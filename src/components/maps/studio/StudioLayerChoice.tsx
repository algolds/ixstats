"use client";

import { useId } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import type { PhysicalLayer } from "~/lib/maps/import/options";
import { LAYER_CHOICES } from "~/lib/worldgen/studio-apply";

interface StudioLayerChoiceProps {
  value: readonly PhysicalLayer[];
  onChange: (layers: PhysicalLayer[]) => void;
  /** The realm is Ixnay: nothing is written without a layer ticked */
  required: boolean;
  /** Why a layer can't be ticked, by layer: the world has none of it, so writing it would only remove the realm's */
  unavailable: Partial<Record<PhysicalLayer, string>>;
}

/**
 * The admin layer choice: which physical layers of a world fitted to a realm's map replace the realm's own. Land,
 * borders and nations are never written. Site admins only: the founder's apply region has no such controls.
 */
export function StudioLayerChoice({
  value,
  onChange,
  required,
  unavailable,
}: StudioLayerChoiceProps) {
  const hintId = useId();
  return (
    <fieldset className="space-y-2" aria-describedby={hintId}>
      <legend className="text-footnote font-medium">Layers to write</legend>
      <p id={hintId} className="text-label-secondary text-caption">
        {required
          ? "Ticked layers replace Ixnay's current layers of that kind. Land, borders and nations are never written."
          : "Ticked layers replace the realm's current layers of that kind. With none ticked, only layers the realm does not have yet are added and its own are kept. Land, borders and nations are never written."}
      </p>
      {LAYER_CHOICES.map(({ layer, label }) => (
        <div key={layer}>
          <label className="text-footnote flex items-center gap-2">
            <Checkbox
              checked={value.includes(layer) && !unavailable[layer]}
              disabled={!!unavailable[layer]}
              aria-describedby={unavailable[layer] ? `${hintId}-${layer}` : undefined}
              onCheckedChange={(on) =>
                onChange(
                  on === true
                    ? LAYER_CHOICES.map((c) => c.layer).filter(
                        (candidate) => candidate === layer || value.includes(candidate)
                      )
                    : value.filter((candidate) => candidate !== layer)
                )
              }
            />
            {label}
          </label>
          {unavailable[layer] && (
            <p id={`${hintId}-${layer}`} className="text-label-secondary text-caption pl-6">
              {unavailable[layer]}
            </p>
          )}
        </div>
      ))}
    </fieldset>
  );
}
