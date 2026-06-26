"use client";

// src/app/labs/onoma/components/sections/PlacesSection.tsx
// Onoma Lab — Geographical & Place Naming Section

import { useState } from "react";
import { GeneratorPanel } from "../shared/GeneratorPanel";
import type { NameCategory } from "~/lib/onoma/types";
import { FacetTabs } from "~/components/facet-ui";

export function PlacesSection() {
  const [activeTab, setActiveTab] = useState<NameCategory>("city");

  const tabs = [
    {
      id: "city",
      label: "Cities & Towns",
      desc: "Assemble names for capitals, settlements, colonies, and administrative cities.",
    },
    {
      id: "province",
      label: "Provinces & States",
      desc: "Assemble names for regional subdivisions, provinces, cantons, and states.",
    },
    {
      id: "country",
      label: "Nations & Realms",
      desc: "Assemble names for sovereign nations, kingdoms, empires, and republics.",
    },
    {
      id: "geography",
      label: "Landmarks & Features",
      desc: "Assemble names for mountains, valleys, rivers, bays, and natural landmarks.",
    },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      {/* Sub-tabs bar */}
      <FacetTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as NameCategory)}
        tone="accent"
        size="sm"
      />

      {/* Generator Panel */}
      <GeneratorPanel
        category={activeTab}
        title={currentTab.label}
        description={currentTab.desc}
        subTypes={[]}
      />
    </div>
  );
}

export default PlacesSection;
