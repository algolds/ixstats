"use client";

import React, { useState, useEffect } from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import ShieldRenderer from "../renderer/ShieldRenderer";
import { api } from "~/trpc/react";

import { FacetMaterial } from "~/components/facet-ui";

function ChargeSvgLoader({
  chargeId,
  onLoaded,
}: {
  chargeId: string;
  onLoaded: (id: string, svg: string) => void;
}) {
  const isTemplate = ["star", "cross", "fleur-de-lis", "lion", "eagle"].includes(chargeId);
  const { data } = api.heraldry.getChargeById.useQuery(
    { id: chargeId },
    { enabled: !isTemplate && !!chargeId }
  );

  useEffect(() => {
    if (data?.svgData) {
      onLoaded(chargeId, data.svgData);
    }
  }, [data, chargeId, onLoaded]);

  return null;
}

export default function PreviewPanel() {
  const { composition, selectLayer } = useVexelEditor();
  const [customChargeSvgs, setCustomChargeSvgs] = useState<Record<string, string>>({});

  const handleChargeSvgLoaded = (id: string, svg: string) => {
    setCustomChargeSvgs((prev) => ({ ...prev, [id]: svg }));
  };

  const customChargeIds = Array.from(
    new Set(
      (composition.shield.charges ?? [])
        .map((c) => c.chargeId)
        .filter((id) => !["star", "cross", "fleur-de-lis", "lion", "eagle"].includes(id))
    )
  );

  return (
    <FacetMaterial
      material="satin"
      className="h-[450px] overflow-hidden rounded-xl border border-white/10"
    >
      <div className="flex h-full flex-col p-4">
        <h2 className="mb-4 border-b border-white/5 pb-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
          Live Render
        </h2>

        {/* Render custom loaders */}
        {customChargeIds.map((id) => (
          <ChargeSvgLoader key={id} chargeId={id} onLoaded={handleChargeSvgLoaded} />
        ))}

        {/* Canvas */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-zinc-950/40 p-6">
          <div className="relative flex aspect-square max-h-full max-w-full items-center justify-center">
            {/* External Ornaments placeholders (e.g. Helm) */}
            {composition.externals?.helm && (
              <div className="absolute -top-12 z-20 flex flex-col items-center">
                <span className="animate-bounce text-3xl duration-1000">🪖</span>
              </div>
            )}

            <ShieldRenderer
              composition={composition}
              width="100%"
              height="100%"
              onElementClick={(path) => selectLayer(path)}
              customChargeSvgs={customChargeSvgs}
            />

            {/* Motto scroll placeholder */}
            {composition.externals?.motto && (
              <div
                className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 ${
                  composition.externals.motto.position === "above" ? "-top-10" : "-bottom-4"
                }`}
              >
                <div className="animate-in fade-in zoom-in-95 rounded-md border border-amber-600/30 bg-amber-500/90 px-4 py-1.5 font-serif text-[10px] font-bold tracking-wider whitespace-nowrap text-zinc-950 uppercase shadow-md duration-200">
                  📜 {composition.externals.motto.text}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </FacetMaterial>
  );
}
