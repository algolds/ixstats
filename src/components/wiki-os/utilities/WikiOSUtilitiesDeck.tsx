"use client";

import React, { useState, useDeferredValue, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Book, Compass, EditPencil, Activity, Shield, X } from "iconoir-react";
import { DiscoverySection } from "./domain/DiscoverySection";
import { EditorialSection } from "./domain/EditorialSection";
import { DiagnosticSection } from "./domain/DiagnosticSection";
import { GovernanceSection } from "./domain/GovernanceSection";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";

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
    domainParam &&
      ["all", "discovery", "editorial", "diagnostics", "governance"].includes(domainParam)
      ? domainParam
      : defaultDomain
  );
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      domainParam &&
      ["all", "discovery", "editorial", "diagnostics", "governance"].includes(domainParam)
    ) {
      // oxlint-disable-next-line
      setSelectedDomain(domainParam);
    }
  }, [domainParam]);

  // Global shortcut to focus search on '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
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
        <SegmentedControl
          aria-label="Utility domain"
          value={selectedDomain}
          onValueChange={(v) => setSelectedDomain(v as UtilityDomain)}
          options={domains.map((dom) => {
            const Icon = dom.icon;
            return {
              value: dom.id as UtilityDomain,
              icon: <Icon />,
              label: (
                <span className="flex items-center gap-1">
                  <span>{dom.label}</span>
                  <span className="text-caption text-label-secondary tabular-nums">
                    {dom.count}
                  </span>
                </span>
              ),
              "aria-label": `${dom.label} (${dom.count})`,
            };
          })}
        />

        {/* Search / Spotlight Filter */}
        <div className="relative max-w-md min-w-[280px] flex-1 sm:max-w-xs">
          <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            data-cuelume-hover="tick"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools or type Special:..."
            className="border-separator bg-surface text-label placeholder:text-label-tertiary focus:border-tint/60 focus:ring-tint/30 rounded-row text-footnote w-full border py-2 pr-8 pl-9 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:outline-none"
          />
          {searchQuery ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              title="Clear search (Esc)"
              className="text-label-secondary absolute top-1/2 right-2 size-6 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <kbd className="text-label-secondary border-separator bg-fill-3 py-0.2 rounded-control-sm text-footnote pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 border px-1 tabular-nums">
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
