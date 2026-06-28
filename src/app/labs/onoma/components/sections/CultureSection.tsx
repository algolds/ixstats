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
        description="Assemble names for indigenous tribes, historical ethnicities, linguistic dialects, or demographic profiles."
        subTypes={[
          { value: "generic", label: "Cultures & Ethnicities" },
          { value: "sports", label: "Sports & Traditional Games" },
          { value: "cuisine", label: "Cuisine & Foods" },
          { value: "architecture", label: "Architecture & Landmarks" },
        ]}
      />
    </div>
  );
}

export default CultureSection;
