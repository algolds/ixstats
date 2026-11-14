"use client";

import React, { useState, useEffect } from "react";
import { useVexelEditor } from "../VexelEditorProvider";
import ShieldRenderer from "../renderer/ShieldRenderer";
import { api } from "~/trpc/react";
import { isBuiltinCharge } from "../builtin-charges";

function ChargeSvgLoader({
  chargeId,
  onLoaded,
}: {
  chargeId: string;
  onLoaded: (id: string, svg: string) => void;
}) {
  const isTemplate = isBuiltinCharge(chargeId);
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

export default function PreviewPanel({ onPick }: { onPick?: () => void }) {
  const { composition, selectLayer } = useVexelEditor();
  const [customChargeSvgs, setCustomChargeSvgs] = useState<Record<string, string>>({});

  const handleChargeSvgLoaded = (id: string, svg: string) => {
    setCustomChargeSvgs((prev) => ({ ...prev, [id]: svg }));
  };

  const customChargeIds = Array.from(
    new Set(
      (composition.shield.charges ?? []).map((c) => c.chargeId).filter((id) => !isBuiltinCharge(id))
    )
  );

  return (
    <div className="relative flex min-h-[420px] flex-1 items-center justify-center p-10 md:min-h-[520px]">
      {customChargeIds.map((id) => (
        <ChargeSvgLoader key={id} chargeId={id} onLoaded={handleChargeSvgLoaded} />
      ))}

      <div className="relative flex aspect-square h-full max-h-[440px] w-full max-w-[440px] items-center justify-center">
        {composition.externals?.helm && (
          <span className="text-caption text-label-secondary absolute -top-8">Helm</span>
        )}

        <ShieldRenderer
          composition={composition}
          width="100%"
          height="100%"
          onElementClick={(path) => {
            selectLayer(path);
            onPick?.();
          }}
          customChargeSvgs={customChargeSvgs}
        />

        {composition.externals?.motto && (
          <span
            className={`text-callout bg-surface-elevated text-label shadow-floating rounded-control pointer-events-none absolute left-1/2 -translate-x-1/2 px-4 py-2 whitespace-nowrap ${
              composition.externals.motto.position === "above" ? "-top-10" : "-bottom-6"
            }`}
          >
            {composition.externals.motto.text}
          </span>
        )}
      </div>
    </div>
  );
}
