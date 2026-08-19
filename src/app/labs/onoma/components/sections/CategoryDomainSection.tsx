"use client";

// src/app/labs/onoma/components/sections/CategoryDomainSection.tsx
// Unified declarative domain section powered by domain-taxonomies.ts

import React, { useState } from "react";
import { GeneratorPanel } from "../shared/GeneratorPanel";
import { FacetTabs } from "~/components/ui/facet";
import type { NameCategory } from "~/lib/onoma/types";
import { DOMAIN_CONFIGS } from "./domain-taxonomies";

interface CategoryDomainSectionProps {
  domain: "places" | "people" | "organizations" | "culture" | "military";
}

export function CategoryDomainSection({ domain }: CategoryDomainSectionProps) {
  const config = DOMAIN_CONFIGS[domain];
  const [activeTab, setActiveTab] = useState<NameCategory>(config?.defaultTab || "city");

  if (!config) return null;

  const currentTab = config.tabs.find((t) => t.id === activeTab) || config.tabs[0];

  return (
    <div className="space-y-6">
      {config.tabs.length > 1 && (
        <FacetTabs
          tabs={config.tabs}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as NameCategory)}
          tone="accent"
          size="sm"
        />
      )}

      <GeneratorPanel
        category={activeTab}
        title={currentTab.label}
        description={currentTab.desc}
        subTypes={currentTab.subTypes || []}
        defaultSubType="generic"
      />
    </div>
  );
}

export default CategoryDomainSection;
