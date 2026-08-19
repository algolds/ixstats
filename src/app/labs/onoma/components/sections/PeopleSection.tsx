"use client";

// src/app/labs/onoma/components/sections/PeopleSection.tsx
// Onoma Lab — Characters & Dynasties Naming Section

import { useState } from "react";
import { GeneratorPanel } from "../shared/GeneratorPanel";
import type { NameCategory } from "~/lib/onoma/types";
import { FacetTabs } from "~/components/ui/facet";

export function PeopleSection() {
  const [activeTab, setActiveTab] = useState<NameCategory>("person");

  const tabs = [
    {
      id: "person",
      label: "Characters & Rulers",
      desc: "Assemble names for leaders, commanders, politicians, or specific role-play species.",
    },
    {
      id: "dynasty",
      label: "Houses & Dynasties",
      desc: "Assemble family, clan, dynasty, or royal house surnames.",
    },
  ];

  const speciesSubTypes = [
    { value: "generic", label: "Human Name (Default)" },
    { value: "goblin", label: "Goblin Name Preset" },
    { value: "orc", label: "Orc Name Preset" },
    { value: "ogre", label: "Ogre Name Preset" },
    { value: "primitive", label: "Primitive / Tribe Name Preset" },
    { value: "dwarf", label: "Dwarf Name Preset" },
    { value: "halfling", label: "Halfling Name Preset" },
    { value: "gnome", label: "Gnome Name Preset" },
    { value: "elf", label: "High Elf Name Preset" },
    { value: "elf-alt", label: "Elf Alternate Suffixes Preset" },
    { value: "faery", label: "Fey / Faery Name Preset" },
    { value: "faery-alt", label: "Faery Alternate Preset" },
    { value: "dark-elf", label: "Dark Elf Name Preset" },
    { value: "dark-elf-alt", label: "Dark Elf Alternate Preset" },
    { value: "half-demon", label: "Half-Demon Name Preset" },
    { value: "dragon", label: "Dragon Name Preset" },
    { value: "demon", label: "Demon Name Preset" },
    { value: "angel", label: "Angel Name Preset" },
  ];

  const dynastySubTypes = [
    { value: "generic", label: "Dynasty Name (Default)" },
    { value: "fantasy-syllable", label: "Syllable-Concatenated Surname" },
    { value: "noble-surname", label: "Noble / Clan Surname" },
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
        subTypes={activeTab === "person" ? speciesSubTypes : dynastySubTypes}
        defaultSubType="generic"
      />
    </div>
  );
}

export default PeopleSection;
