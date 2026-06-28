"use client";

// src/app/labs/onoma/components/sections/MilitarySection.tsx
// Onoma Lab — Military Units & Vessels Naming Section

import { useState } from "react";
import { GeneratorPanel } from "../shared/GeneratorPanel";
import type { NameCategory } from "~/lib/onoma/types";
import { FacetTabs } from "~/components/facet-ui";

export function MilitarySection() {
  const [activeTab, setActiveTab] = useState<NameCategory>("military");

  const tabs = [
    {
      id: "military",
      label: "Units & Operations",
      desc: "Assemble names for military regiments, divisions, brigades, task forces, or military operations.",
    },
    {
      id: "ship",
      label: "Naval Ships & Assets",
      desc: "Assemble names for aircraft carriers, destroyers, submarines, and fleets.",
    },
  ];

  const militarySubTypes = [
    { value: "generic", label: "Military Name (Default)" },
    { value: "military-unit", label: "Template-Generated Military Unit" },
    { value: "mercenary-band", label: "Mercenary Company / Band" },
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
        subTypes={activeTab === "military" ? militarySubTypes : []}
        defaultSubType="generic"
      />
    </div>
  );
}

export default MilitarySection;
