"use client";

// src/app/labs/onoma/components/sections/CultureSection.tsx
// Onoma Lab — Cultures, Tribes & Ethnicities Naming Section

import { GeneratorPanel } from "../shared/GeneratorPanel";

export function CultureSection() {
  return (
    <div className="space-y-6">
      <GeneratorPanel
        category="culture"
        title="Cultures & Ethnicities"
        description="Generate names for indigenous tribes, historical ethnicities, linguistic dialects, traditional sports, and regional cuisine — each trained on a curated dictionary for its category."
        subTypes={[
          { value: "generic", label: "Cultures & Ethnicities" },
          { value: "sports", label: "Sports & Traditional Games" },
          { value: "cuisine", label: "Cuisine & Foods" },
        ]}
      />
    </div>
  );
}

export default CultureSection;
