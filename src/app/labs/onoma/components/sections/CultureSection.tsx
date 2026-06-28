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
        description="Generate names for indigenous tribes, historical ethnicities, and linguistic dialects, or draw real-world examples of traditional sports and cuisine for inspiration."
        subTypes={[
          { value: "generic", label: "Cultures & Ethnicities" },
          { value: "sports", label: "Sports & Games (real examples)" },
          { value: "cuisine", label: "Cuisine & Foods (real examples)" },
        ]}
      />
    </div>
  );
}

export default CultureSection;
