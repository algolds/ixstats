"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React, { useState, useEffect } from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import ShieldRenderer from "../renderer/ShieldRenderer";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";

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
    <Card className="h-[450px] overflow-hidden">
      <div className="flex h-full flex-col p-4">
        <h2 className="border-separator text-label text-headline mb-4 border-b pb-2">
          Live render
        </h2>

        {customChargeIds.map((id) => (
          <ChargeSvgLoader key={id} chargeId={id} onLoaded={handleChargeSvgLoaded} />
        ))}

        <Card
          variant="well"
          padding="none"
          className="relative flex flex-1 items-center justify-center overflow-hidden p-6"
        >
          <div className="relative flex aspect-square max-h-full max-w-full items-center justify-center">
            {/* External Ornaments placeholders (e.g. Helm) */}
            {composition.externals?.helm && (
              <div className="absolute -top-12 z-20 flex flex-col items-center">
                <Eyebrow>Helm</Eyebrow>
              </div>
            )}

            <ShieldRenderer
              composition={composition}
              width="100%"
              height="100%"
              onElementClick={(path) => selectLayer(path)}
              customChargeSvgs={customChargeSvgs}
            />

            {composition.externals?.motto && (
              <div
                className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 ${
                  composition.externals.motto.position === "above" ? "-top-10" : "-bottom-4"
                }`}
              >
                <Eyebrow className="animate-in fade-in zoom-in-95 rounded-control-sm bg-surface-elevated text-label shadow-floating block px-4 py-2 whitespace-nowrap duration-200">
                  {composition.externals.motto.text}
                </Eyebrow>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Card>
  );
}
