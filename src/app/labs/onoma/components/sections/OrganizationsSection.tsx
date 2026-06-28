"use client";

// src/app/labs/onoma/components/sections/OrganizationsSection.tsx
// Onoma Lab — Guilds, Orders & Establishments Naming Section

import { GeneratorPanel } from "../shared/GeneratorPanel";

export function OrganizationsSection() {
  const orgSubTypes = [
    { value: "generic", label: "Organization Name (Default)" },
    { value: "political-party", label: "Political Party / Movement" },
    { value: "government-agency", label: "Government Ministry / Agency" },
    { value: "media-outlet", label: "News / Media Outlet" },
    { value: "ngo-foundation", label: "NGO / Foundation" },
    { value: "religious-order", label: "Religious Order / Church" },
    { value: "business-company", label: "Business / Company" },
    { value: "academic-institution", label: "Academic Institution" },
    { value: "mystic-order", label: "Mystic & Academic Order" },
    { value: "covert-org", label: "Covert & Thieves Guild" },
    { value: "tavern", label: "Tavern & Brew House Establishment" },
  ];

  return (
    <div className="space-y-6">
      <GeneratorPanel
        category="organization"
        title="Guilds & Organizations"
        description="Assemble names for political parties, government agencies, media outlets, NGOs, churches, companies, universities, guilds, and taverns."
        subTypes={orgSubTypes}
        defaultSubType="generic"
      />
    </div>
  );
}

export default OrganizationsSection;
