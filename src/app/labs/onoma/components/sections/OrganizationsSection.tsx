"use client";

// src/app/labs/onoma/components/sections/OrganizationsSection.tsx
// Onoma Lab — Guilds, Orders & Establishments Naming Section

import { GeneratorPanel } from "../shared/GeneratorPanel";

export function OrganizationsSection() {
  const orgSubTypes = [
    { value: "generic", label: "Markov Organization Name (Default)" },
    { value: "mystic-order", label: "Mystic & Academic Order" },
    { value: "covert-org", label: "Covert & Thieves Guild" },
    { value: "tavern", label: "Tavern & Brew House Establishment" },
  ];

  return (
    <div className="space-y-6">
      <GeneratorPanel
        category="organization"
        title="Guilds & Organizations"
        description="Assemble names for mystical societies, commercial guilds, universities, covert alliances, and taverns."
        subTypes={orgSubTypes}
        defaultSubType="generic"
      />
    </div>
  );
}

export default OrganizationsSection;
