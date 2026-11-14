"use client";

import { FacetMaterial } from "~/components/ui/facet";
import { STUDIO_GROUPS } from "~/lib/worldgen/studio-fields";
import { useStudio } from "./StudioContext";
import { StudioRailGroup } from "./StudioRailGroup";
import { StudioSourceSection } from "./StudioSourceSection";

/** The parameter rail: the source, then every generator parameter in the group of the stage that reads it. */
export function StudioRail() {
  const { params, presetParams, setParams, resetFields, source } = useStudio();
  return (
    <FacetMaterial
      as="section"
      layer="chrome"
      data-content="input"
      className="facet-chrome-subtle rounded-row pointer-events-auto flex min-h-0 flex-col overflow-hidden"
      aria-label="Parameters"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <StudioSourceSection />
        {STUDIO_GROUPS.map((group) => (
          <StudioRailGroup
            key={group.id}
            group={group}
            params={params}
            base={presetParams}
            fitting={source.kind === "fit"}
            onCommit={setParams}
            onReset={resetFields}
          />
        ))}
      </div>
    </FacetMaterial>
  );
}
