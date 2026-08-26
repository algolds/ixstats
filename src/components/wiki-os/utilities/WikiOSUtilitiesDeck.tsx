"use client";

import React, { useState, useDeferredValue, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Book,
  Compass,
  EditPencil,
  Activity,
  Shield,
  X,
} from "iconoir-react";
import { motion } from "motion/react";
import { DiscoverySection } from "./domain/DiscoverySection";
import { EditorialSection } from "./domain/EditorialSection";
import { DiagnosticSection } from "./domain/DiagnosticSection";
import { GovernanceSection } from "./domain/GovernanceSection";

export type UtilityDomain = "all" | "discovery" | "editorial" | "diagnostics" | "governance";

interface WikiOSUtilitiesDeckProps {
  embedded?: boolean;
  defaultDomain?: UtilityDomain;
}

export function WikiOSUtilitiesDeck({
  embedded = false,
  defaultDomain = "all",
}: WikiOSUtilitiesDeckProps) {
  const searchParams = useSearchParams();
  const domainParam = searchParams.get("domain") as UtilityDomain | null;
  const [selectedDomain, setSelectedDomain] = useState<UtilityDomain>(
    domainParam && ["all", "discovery", "editorial", "diagnostics", "governance"].includes(domainParam)
      ? domainParam
      : defaultDomain
  );
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (domainParam && ["all", "discovery", "editorial", "diagnostics", "governance"].includes(domainParam)) {
      // oxlint-disable-next-line
      setSelectedDomain(domainParam);
    }
  }, [domainParam]);

  // Global shortcut to focus search on '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const domains = [
    { id: "all", label: "All Utilities", count: 21, icon: Book },
    { id: "discovery", label: "Discovery", count: 8, icon: Compass },
    { id: "editorial", label: "Editorial", count: 5, icon: EditPencil },
    { id: "diagnostics", label: "Diagnostics", count: 5, icon: Activity },
    { id: "governance", label: "Governance", count: 3, icon: Shield },
  ];

  return (
    <div className={`space-y-6 ${embedded ? "p-0" : "mx-auto max-w-7xl px-4 py-8 sm:px-6"}`}>
      {/* Spotlight Command Search & Segmented Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Domain Segmented Control with Apple Spring Pill Physics */}
        <div className="relative flex flex-wrap items-center gap-1 rounded-xl border border-border/40 bg-card/60 p-1 backdrop-blur-xl shadow-xs">
          {domains.map((dom) => {
            const Icon = dom.icon;
            const isSelected = selectedDomain === dom.id;
            return (
              <button
                key={dom.id}
                type="button"
                data-cuelume-press="soft"
                data-cuelume-hover="tick"
                onClick={() => setSelectedDomain(dom.id as UtilityDomain)}
                className={`relative z-10 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.98] ${
                  isSelected
                    ? "text-black dark:text-black font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeUtilityDomain"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                    className="absolute inset-0 -z-10 rounded-lg bg-wiki shadow-xs"
                  />
                )}
                <Icon className="h-3.5 w-3.5" />
                <span>{dom.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? "bg-black/20 text-black font-bold" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {dom.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search / Spotlight Filter */}
        <div className="relative min-w-[280px] max-w-md flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            data-cuelume-hover="tick"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools or type Special:..."
            className="w-full rounded-xl border border-border/40 bg-card/60 py-1.5 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground/60 backdrop-blur-xl transition-all focus:border-wiki/60 focus:outline-none focus:ring-2 focus:ring-wiki/30 shadow-xs"
          />
          {searchQuery ? (
            <button
              type="button"
              data-cuelume-press="tap"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md active:scale-90"
              title="Clear search (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted-foreground/60 rounded border border-border/40 bg-secondary/50 px-1 py-0.2">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Render Domains */}
      <div className="space-y-8">
        {(selectedDomain === "all" || selectedDomain === "discovery") && (
          <DiscoverySection searchFilter={deferredQuery} />
        )}

        {(selectedDomain === "all" || selectedDomain === "editorial") && (
          <EditorialSection searchFilter={deferredQuery} />
        )}

        {(selectedDomain === "all" || selectedDomain === "diagnostics") && (
          <DiagnosticSection searchFilter={deferredQuery} />
        )}

        {(selectedDomain === "all" || selectedDomain === "governance") && (
          <GovernanceSection searchFilter={deferredQuery} />
        )}
      </div>
    </div>
  );
}
