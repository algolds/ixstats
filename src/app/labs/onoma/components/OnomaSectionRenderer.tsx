"use client";

// src/app/labs/onoma/components/OnomaSectionRenderer.tsx
// Dynamic loader and view dispatcher for active Onoma workspace sections

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { OnomaSection, StudioSubTab } from "~/lib/onoma/types";

// Standard synchronous core sections for instant transitions
import OverviewSection from "./sections/OverviewSection";
import CategoryDomainSection from "./sections/CategoryDomainSection";

// Suspense loading fallback
const SectionLoadingFallback = () => (
  <div className="flex h-64 w-full items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-[#0091ff]" />
  </div>
);

// Heavy/Specialized sections loaded on demand
const StudioSection = dynamic(() => import("./sections/StudioSection"), {
  loading: SectionLoadingFallback,
  ssr: false,
});

const MarketplaceSection = dynamic(() => import("./sections/MarketplaceSection"), {
  loading: SectionLoadingFallback,
  ssr: false,
});

const StashSection = dynamic(() => import("./sections/StashSection"), {
  loading: SectionLoadingFallback,
  ssr: false,
});

const SettingsSection = dynamic(() => import("./sections/SettingsSection"), {
  loading: SectionLoadingFallback,
  ssr: false,
});

interface OnomaSectionRendererProps {
  activeSection: OnomaSection;
  activeSubTab: StudioSubTab;
  setActiveSubTab: (tab: StudioSubTab) => void;
  studioInitialWords?: string[];
  studioInitialTitle?: string;
  onClearStudioInitial: () => void;
  onLoadToStudio: (words: string[], title: string) => void;
}

export function OnomaSectionRenderer({
  activeSection,
  activeSubTab,
  setActiveSubTab,
  studioInitialWords,
  studioInitialTitle,
  onClearStudioInitial,
  onLoadToStudio,
}: OnomaSectionRendererProps) {
  switch (activeSection) {
    case "overview":
      return <OverviewSection />;
    case "places":
      return <CategoryDomainSection domain="places" />;
    case "people":
      return <CategoryDomainSection domain="people" />;
    case "military":
      return <CategoryDomainSection domain="military" />;
    case "organizations":
      return <CategoryDomainSection domain="organizations" />;
    case "culture":
      return <CategoryDomainSection domain="culture" />;
    case "history":
      return <StashSection onLoadToStudio={onLoadToStudio} />;
    case "linguistics":
    case "compare":
    case "etymology":
    case "syntax":
    case "writing":
    case "loanwords":
      return (
        <StudioSection
          activeSubTab="linguistics"
          setActiveSubTab={setActiveSubTab}
          initialWords={studioInitialWords}
          initialTitle={studioInitialTitle}
          onClearInitial={onClearStudioInitial}
        />
      );
    case "marketplace":
      return <MarketplaceSection />;
    case "studio":
      return (
        <StudioSection
          activeSubTab={activeSubTab}
          setActiveSubTab={setActiveSubTab}
          initialWords={studioInitialWords}
          initialTitle={studioInitialTitle}
          onClearInitial={onClearStudioInitial}
        />
      );
    case "bank":
      return <StashSection onLoadToStudio={onLoadToStudio} />;
    case "settings":
      return <SettingsSection />;
    default:
      return <OverviewSection />;
  }
}
