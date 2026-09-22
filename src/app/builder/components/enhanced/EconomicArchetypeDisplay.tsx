"use client";

import React, { useState, memo, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Archery as Target, Search } from "iconoir-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import type { EconomyBuilderState } from "~/types/economy-builder";
import { useArchetypes } from "~/hooks/useArchetypes";
import { modernArchetypes } from "~/lib/economy/archetypes/modern";
import { ArchetypeCard, ArchetypeDetailsModal } from "./archetypes";

export interface EconomicArchetypeDisplayProps {
  className?: string;
  currentState?: EconomyBuilderState;
  onArchetypeApplied?: (
    newState: EconomyBuilderState,
    archetypeId?: string,
    archetype?: EconomicArchetype
  ) => void;
  era?: "modern" | "historical" | "all";
}

export const EconomicArchetypeDisplay = memo(function EconomicArchetypeDisplay({
  className,
  currentState,
  onArchetypeApplied,
  era = "all",
}: EconomicArchetypeDisplayProps) {
  const [selectedArchetype, setSelectedArchetype] = useState<EconomicArchetype | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("modern");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fetch archetypes from database with fallback
  const { archetypes } = useArchetypes(era);

  const [searchQuery, setSearchQuery] = useState("");
  const [complexityFilter, setComplexityFilter] = useState<string>("all");

  const filteredArchetypes = useMemo(() => {
    return (archetypes || []).filter((archetype) => {
      // 1. Filter by Active Tab (modern vs historical)
      const archetypeWithEra = archetype as EconomicArchetype & { era?: string };
      const archetypeEra =
        archetypeWithEra.era || (modernArchetypes.has(archetype.id) ? "modern" : "historical");
      if (archetypeEra !== activeTab) {
        return false;
      }

      // 2. Search Query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = archetype.name?.toLowerCase().includes(query);
        const matchesDesc = archetype.description?.toLowerCase().includes(query);
        const matchesRegion = archetype.region?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesRegion) {
          return false;
        }
      }

      // 3. Complexity Filter
      if (complexityFilter !== "all") {
        if (archetype.implementationComplexity !== complexityFilter) {
          return false;
        }
      }

      return true;
    });
  }, [archetypes, searchQuery, complexityFilter, activeTab]);

  const handleApplyArchetype = (archetypeToApply?: EconomicArchetype) => {
    const target = archetypeToApply || selectedArchetype;
    if (!target) return;

    setIsLoading(true);
    try {
      const archetypeId = target.id;
      if (currentState) {
        onArchetypeApplied?.(currentState, archetypeId, target);
      }
      setIsDetailsOpen(false);
      setSelectedArchetype(null);
    } catch (error) {
      console.error("Failed to apply archetype:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedArchetypeId = (currentState as { selectedArchetypeId?: string } | undefined)
    ?.selectedArchetypeId;

  return (
    <div className={`space-y-6 ${className ?? ""}`}>
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 border-border grid h-11 w-full grid-cols-2 rounded-xl border p-1">
          <TabsTrigger
            value="modern"
            className="text-muted-foreground cursor-pointer rounded-lg text-sm font-medium transition-all data-[state=active]:bg-emerald-600/10 data-[state=active]:font-semibold data-[state=active]:text-emerald-600 dark:data-[state=active]:bg-emerald-500/15 dark:data-[state=active]:text-emerald-400"
          >
            Modern Archetypes
          </TabsTrigger>
          <TabsTrigger
            value="historical"
            className="text-muted-foreground cursor-pointer rounded-lg text-sm font-medium transition-all data-[state=active]:bg-emerald-600/10 data-[state=active]:font-semibold data-[state=active]:text-emerald-600 dark:data-[state=active]:bg-emerald-500/15 dark:data-[state=active]:text-emerald-400"
          >
            Historical Archetypes
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-6">
          {archetypes.length > 0 && (
            <div className="border-border/40 bg-card/10 flex flex-col gap-4 rounded-xl border p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search Input */}
                <div className="relative max-w-md flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search archetypes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background/30 border-border/50 pr-4 pl-9 text-sm"
                  />
                </div>

                {/* Complexity Filter */}
                <Select value={complexityFilter} onValueChange={setComplexityFilter}>
                  <SelectTrigger className="bg-background/30 border-border/50 w-full sm:w-44">
                    <SelectValue placeholder="Select Complexity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Complexities</SelectItem>
                    <SelectItem value="low">Low Complexity</SelectItem>
                    <SelectItem value="medium">Medium Complexity</SelectItem>
                    <SelectItem value="high">High Complexity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Counter */}
              <div className="text-muted-foreground shrink-0 text-xs font-semibold">
                Showing {filteredArchetypes.length} of{" "}
                {
                  archetypes.filter((a) => {
                    const archetypeWithEra = a as EconomicArchetype & { era?: string };
                    const archetypeEra =
                      archetypeWithEra.era || (modernArchetypes.has(a.id) ? "modern" : "historical");
                    return archetypeEra === activeTab;
                  }).length
                }
              </div>
            </div>
          )}

          {archetypes.length === 0 ? (
            <div className="border-border bg-card/25 rounded-xl border-2 border-dashed p-16 text-center">
              <div className="space-y-4">
                <div className="bg-muted border-border mx-auto w-fit rounded-full border p-4">
                  <Target className="text-muted-foreground h-8 w-8" />
                </div>
                <h3 className="text-foreground text-lg font-semibold">No Archetypes Available</h3>
                <p className="text-muted-foreground mx-auto max-w-md text-sm">
                  Economic archetypes are being loaded. If this persists, contact the administrator.
                </p>
              </div>
            </div>
          ) : filteredArchetypes.length === 0 ? (
            <div className="border-border bg-card/25 rounded-xl border-2 border-dashed p-16 text-center">
              <div className="space-y-4">
                <div className="bg-muted border-border mx-auto w-fit rounded-full border p-4">
                  <Target className="text-muted-foreground h-8 w-8" />
                </div>
                <h3 className="text-foreground text-lg font-semibold">No Matching Archetypes</h3>
                <p className="text-muted-foreground mx-auto max-w-md text-sm">
                  No archetypes match your current search and filter settings. Try clearing them.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredArchetypes.map((archetype) => (
                <ArchetypeCard
                  key={archetype.id}
                  archetype={archetype}
                  isSelected={selectedArchetypeId === archetype.id}
                  showSelectButton={true}
                  onSelect={handleApplyArchetype}
                  onOpenDetails={(arch) => {
                    setSelectedArchetype(arch);
                    setIsDetailsOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </Tabs>

      {/* Details Modal */}
      <ArchetypeDetailsModal
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        archetype={selectedArchetype}
        isGloballySelected={Boolean(
          selectedArchetype && selectedArchetypeId === selectedArchetype.id
        )}
        isLoading={isLoading}
        onApply={handleApplyArchetype}
      />
    </div>
  );
});

EconomicArchetypeDisplay.displayName = "EconomicArchetypeDisplay";
