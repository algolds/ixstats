"use client";

// src/app/labs/onoma/components/sections/LinguisticsSection.tsx
// Onoma Lab — Linguistics Suite Wrapper (Facet Rebuild)

import { useState, useMemo, useEffect } from "react";
import { Network, SlidersHorizontal, Feather, Languages, GitCompare } from "lucide-react";
import { FacetTabs } from "~/components/ui/facet";
import { api } from "~/trpc/react";
import { applyFlanking } from "~/lib/onoma/branding-utils";

import EtymologySection from "./EtymologySection";
import SyntaxSection from "./SyntaxSection";
import WritingSection from "./WritingSection";
import LoanwordsSection from "./LoanwordsSection";
import ComparatorSection from "./ComparatorSection";
import { withBasePath } from "~/lib/base-path";

type LinguisticsSubTab = "etymology" | "syntax" | "writing" | "loanwords" | "compare";

const SUB_TAB_TITLES: Record<LinguisticsSubTab, string> = {
  etymology: "Etymological Web",
  syntax: "Syntax & Sentence",
  writing: "Writing System",
  loanwords: "Loanword Registry",
  compare: "Language Comparator",
};

export function LinguisticsSection() {
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery();

  // Sync sub-tab state with URL
  const [activeSubTab, setActiveSubTab] = useState<LinguisticsSubTab>(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.includes("/syntax")) return "syntax";
      if (path.includes("/writing")) return "writing";
      if (path.includes("/loanwords")) return "loanwords";
      if (path.includes("/compare")) return "compare";
      if (path.includes("/etymology")) return "etymology";
    }
    return "etymology";
  });

  const handleNavigateSubTab = (tab: LinguisticsSubTab) => {
    setActiveSubTab(tab);
    const href = `/labs/onoma/studio/linguistics/${tab}`;
    window.history.pushState(null, "", withBasePath(href));
    document.title = `Onoma Lab - Studio: Linguistics - ${SUB_TAB_TITLES[tab]} - IxStats`;
  };

  // Sync URL when popped back/forward
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path.includes("/syntax")) setActiveSubTab("syntax");
      else if (path.includes("/writing")) setActiveSubTab("writing");
      else if (path.includes("/loanwords")) setActiveSubTab("loanwords");
      else if (path.includes("/compare")) setActiveSubTab("compare");
      else setActiveSubTab("etymology");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const tabs = useMemo(
    () => [
      {
        id: "etymology",
        label: "Etymology",
        icon: Network,
        themeColor: "#a855f7",
        glowClassName: "bg-purple-500/10 dark:bg-purple-500/5",
        activeIndicatorClassName:
          "bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400",
        activeTextClassName: "text-purple-600 dark:text-purple-400",
        activeIconClassName: "text-purple-500 dark:text-purple-400",
      },
      {
        id: "syntax",
        label: "Syntax",
        icon: SlidersHorizontal,
        themeColor: "#d946ef",
        glowClassName: "bg-fuchsia-500/10 dark:bg-fuchsia-500/5",
        activeIndicatorClassName:
          "bg-fuchsia-500/5 border-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400",
        activeTextClassName: "text-fuchsia-600 dark:text-fuchsia-400",
        activeIconClassName: "text-fuchsia-500 dark:text-fuchsia-400",
      },
      {
        id: "writing",
        label: "Writing System",
        icon: Feather,
        themeColor: "#10b981",
        glowClassName: "bg-emerald-500/10 dark:bg-emerald-500/5",
        activeIndicatorClassName:
          "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        activeTextClassName: "text-emerald-600 dark:text-emerald-400",
        activeIconClassName: "text-emerald-500 dark:text-emerald-400",
      },
      {
        id: "loanwords",
        label: "Loanwords",
        icon: Languages,
        themeColor: "#06b6d4",
        glowClassName: "bg-cyan-500/10 dark:bg-cyan-500/5",
        activeIndicatorClassName:
          "bg-cyan-500/5 border-cyan-500/20 text-cyan-600 dark:text-cyan-400",
        activeTextClassName: "text-cyan-600 dark:text-cyan-400",
        activeIconClassName: "text-cyan-500 dark:text-cyan-400",
      },
      {
        id: "compare",
        label: "Comparator",
        icon: GitCompare,
        themeColor: "#8b5cf6",
        glowClassName: "bg-violet-500/10 dark:bg-violet-500/5",
        activeIndicatorClassName:
          "bg-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400",
        activeTextClassName: "text-violet-600 dark:text-violet-400",
        activeIconClassName: "text-violet-500 dark:text-violet-400",
      },
    ],
    []
  );

  const renderActiveSection = () => {
    switch (activeSubTab) {
      case "etymology":
        return <EtymologySection />;
      case "syntax":
        return <SyntaxSection />;
      case "writing":
        return <WritingSection />;
      case "loanwords":
        return <LoanwordsSection />;
      case "compare":
        return <ComparatorSection />;
      default:
        return <EtymologySection />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-border/40 flex flex-col gap-3 space-y-2 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2
            className="text-foreground text-xl font-bold tracking-tight"
            style={{
              fontFamily: speechConfig?.brand?.fontFamily
                ? `'${speechConfig.brand.fontFamily}', sans-serif`
                : undefined,
            }}
          >
            {applyFlanking("Linguistics Suite", speechConfig?.brand?.flankingStyle)}
          </h2>
          <p className="text-muted-foreground text-sm">
            Create syntax grammar profiles, design custom script glyphs, track etymology
            derivations, and manage language vocabulary loans.
          </p>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="border-border/30 min-w-[280px] self-start overflow-hidden rounded-xl border shadow-sm md:self-auto">
          <FacetTabs
            tabs={tabs}
            activeTab={activeSubTab}
            onChange={(id) => handleNavigateSubTab(id as LinguisticsSubTab)}
            tone="accent"
            size="sm"
          />
        </div>
      </div>

      <div className="pt-2">{renderActiveSection()}</div>
    </div>
  );
}

export default LinguisticsSection;
