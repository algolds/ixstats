"use client";

import React, { useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { CheckCircle, InfoCircle as Info, Minus, Search } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import type { UnifiedAtomicComponentSelectorProps } from "./types";
import { UnifiedAtomicCard } from "./UnifiedAtomicCard";
import { getThemeColorClasses } from "./themes";
import { useAtomicSelectorState } from "~/hooks/useAtomicSelectorState";
import { FacetCard } from "~/components/ui/facet-container";

export function UnifiedAtomicComponentSelector<T extends string>({
  components,
  categories,
  selectedComponents,
  onComponentChange,
  maxComponents = 15,
  isReadOnly = false,
  theme,
  systemName,
  systemIcon: SystemIcon,
  calculateEffectiveness,
  checkSynergy,
  checkConflict,
}: UnifiedAtomicComponentSelectorProps<T>) {
  const defaultCategory = Object.keys(categories)[0] || "";

  const state = useAtomicSelectorState<T>({
    selectedComponents,
    onSelectionChange: onComponentChange,
    maxComponents,
    isReadOnly,
    defaultCategory,
  });

  const { activeCategory, setActiveCategory, searchQuery, setSearchQuery, handleToggle } = state;

  const currentCategory = activeCategory || defaultCategory;

  const effectiveness = useMemo(
    () => calculateEffectiveness(selectedComponents),
    [selectedComponents, calculateEffectiveness]
  );

  const activeSynergies = useMemo(() => {
    const list: Array<{ comp1: string; comp2: string }> = [];
    for (let i = 0; i < selectedComponents.length; i++) {
      for (let j = i + 1; j < selectedComponents.length; j++) {
        const id1 = selectedComponents[i]!;
        const id2 = selectedComponents[j]!;
        if (checkSynergy(id1, id2) > 0) {
          list.push({ comp1: components[id1]?.name || id1, comp2: components[id2]?.name || id2 });
        }
      }
    }
    return list;
  }, [selectedComponents, components, checkSynergy]);

  const activeConflicts = useMemo(() => {
    const list: Array<{ comp1: string; comp2: string }> = [];
    for (let i = 0; i < selectedComponents.length; i++) {
      for (let j = i + 1; j < selectedComponents.length; j++) {
        const id1 = selectedComponents[i]!;
        const id2 = selectedComponents[j]!;
        if (checkConflict(id1, id2)) {
          list.push({ comp1: components[id1]?.name || id1, comp2: components[id2]?.name || id2 });
        }
      }
    }
    return list;
  }, [selectedComponents, components, checkConflict]);

  const themeClasses = getThemeColorClasses(theme, currentCategory);

  const totalImplementationCost = selectedComponents.reduce(
    (sum, id) => sum + (components[id]?.implementationCost || 0),
    0
  );

  const totalMaintenanceCost = selectedComponents.reduce(
    (sum, id) => sum + (components[id]?.maintenanceCost || 0),
    0
  );

  const filteredComponents = useMemo(() => {
    const categoryComponents = categories[currentCategory] || [];
    if (!searchQuery) return categoryComponents;

    return categoryComponents.filter((id) => {
      const component = components[id];
      return (
        component?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        component?.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [currentCategory, searchQuery, categories, components]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-control border p-2",
                `bg-${themeClasses.primaryLight}/15`,
                `border-${themeClasses.primaryLight}/30`
              )}
            >
              <SystemIcon className={cn("h-5 w-5", `text-${themeClasses.primary}`)} />
            </div>
            <div>
              <CardTitle className="text-label">{systemName}</CardTitle>
              <p className="text-label-secondary text-body mt-1">
                Build your system using modular components with synergies and conflicts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={cn("text-title-1", `text-${themeClasses.primary}`)}>
                {effectiveness.totalEffectiveness.toFixed(0)}
              </div>
              <div className="text-label-secondary text-footnote">Effectiveness</div>
            </div>
            <div className="text-center">
              <div className="text-title-1 text-green">
                +{effectiveness.synergyBonus.toFixed(0)}
              </div>
              <div className="text-label-secondary text-footnote">Synergies</div>
            </div>
            <div className="text-center">
              <div className="text-title-1 text-red">
                -{effectiveness.conflictPenalty.toFixed(0)}
              </div>
              <div className="text-label-secondary text-footnote">Conflicts</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="text-body flex items-center justify-between">
            <span className="text-label font-medium">
              Components: {selectedComponents.length} / {maxComponents}
            </span>
            <span className="text-label-secondary">
              {((selectedComponents.length / maxComponents) * 100).toFixed(0)}%
            </span>
          </div>
          <Progress value={(selectedComponents.length / maxComponents) * 100} className="h-2" />
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-separator bg-surface text-label placeholder:text-label-secondary focus:ring-tint/20 rounded-control w-full border py-2 pr-4 pl-10 focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={currentCategory} onValueChange={(val) => setActiveCategory(val)}>
          <TabsList className="bg-fill-3 grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Object.keys(categories).map((category) => (
              <TabsTrigger
                key={category}
                value={category}
                className="data-[state=active]:bg-surface data-[state=active]:text-label text-footnote"
              >
                <span className="hidden md:inline">{category}</span>
                <span className="md:hidden">{category.split(" ")[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {Object.entries(categories).map(([category, _componentIds]) => (
            <TabsContent key={category} value={category} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence>
                  {filteredComponents.map((componentId) => {
                    const component = components[componentId];
                    if (!component) return null;

                    const isSelected = selectedComponents.includes(componentId as T);
                    const hasConflict = selectedComponents.some((id) =>
                      checkConflict(componentId, id)
                    );
                    const hasSynergy = selectedComponents.some((id) => {
                      const synergy = checkSynergy(componentId, id);
                      return synergy > 0 && !isSelected;
                    });
                    const isDisabled = selectedComponents.length >= maxComponents && !isSelected;

                    return (
                      <UnifiedAtomicCard
                        key={componentId}
                        component={component}
                        isSelected={isSelected}
                        onToggle={() => handleToggle(componentId as T)}
                        isDisabled={isDisabled}
                        hasConflict={hasConflict}
                        hasSynergy={hasSynergy}
                        theme={theme}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Selected Components Summary */}
        {selectedComponents.length > 0 && (
          <FacetCard variant="inset" padding="none" className="space-y-4 p-4">
            <h4 className="text-label flex items-center gap-2 font-semibold">
              <CheckCircle className={cn("h-4 w-4", `text-${themeClasses.primary}`)} />
              Selected Components ({selectedComponents.length})
            </h4>

            <div className="flex flex-wrap gap-2">
              {selectedComponents.map((componentId) => {
                const component = components[componentId];
                if (!component) return null;

                return (
                  <Badge
                    key={componentId}
                    variant="default"
                    className={cn(
                      "flex items-center gap-1",
                      `text-${themeClasses.primary}-ink`,
                      `bg-${themeClasses.selectedBg}`
                    )}
                  >
                    {component.name}
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${component.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggle(componentId as T);
                        }}
                        className="hover:bg-red/15 hover:text-red ml-1 size-4 rounded-full"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    )}
                  </Badge>
                );
              })}
            </div>

            {/* System Metrics */}
            <div className="border-separator grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-label text-title-3">
                  {effectiveness.totalEffectiveness.toFixed(0)}%
                </div>
                <div className="text-label-secondary text-footnote">Total Effectiveness</div>
              </div>

              <div className="text-center">
                <div className="text-title-3 text-green">{effectiveness.synergyCount}</div>
                <div className="text-label-secondary text-footnote">Active Synergies</div>
              </div>

              <div className="text-center">
                <div className={cn("text-title-3", `text-${themeClasses.primary}`)}>
                  ${(totalImplementationCost / 1000).toFixed(0)}k
                </div>
                <div className="text-label-secondary text-footnote">Implementation Cost</div>
              </div>

              <div className="text-center">
                <div className={cn("text-title-3", `text-${themeClasses.primary}`)}>
                  ${(totalMaintenanceCost / 1000).toFixed(0)}k
                </div>
                <div className="text-label-secondary text-footnote">Annual Cost</div>
              </div>
            </div>
          </FacetCard>
        )}

        {/* System Analysis */}
        {selectedComponents.length > 0 && (
          <Alert
            className={cn(
              "border-2",
              `border-${themeClasses.primaryLight}/30`,
              `bg-${themeClasses.selectedBg}`
            )}
          >
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="text-label font-medium">System Analysis:</p>
                <ul className="text-body space-y-1">
                  {effectiveness.synergyCount > effectiveness.conflictCount && (
                    <li className="text-green">
                      ✓ Strong component synergies detected - system efficiency increased by{" "}
                      {effectiveness.synergyBonus.toFixed(0)}%
                    </li>
                  )}
                  {effectiveness.conflictCount > 0 && (
                    <li className="text-red">
                      ⚠ {effectiveness.conflictCount} conflict(s) detected - effectiveness reduced
                      by {effectiveness.conflictPenalty.toFixed(0)}%
                    </li>
                  )}
                  {effectiveness.baseEffectiveness > 85 && (
                    <li className="text-green">
                      ✓ High-effectiveness components selected (avg{" "}
                      {effectiveness.baseEffectiveness.toFixed(0)}%)
                    </li>
                  )}
                  {effectiveness.baseEffectiveness < 75 && (
                    <li className="text-yellow">
                      ⚠ Consider adding higher effectiveness components
                    </li>
                  )}
                  {totalImplementationCost > 1000000 && (
                    <li className="text-yellow">
                      ⚠ High implementation costs - consider phased rollout
                    </li>
                  )}
                </ul>
                {activeSynergies.length > 0 && (
                  <div className="border-green/20 text-footnote text-green mt-2 space-y-0.5 border-t pt-2">
                    <p className="font-semibold">Active Synergies:</p>
                    {activeSynergies.map((syn, idx) => (
                      <p key={idx}>
                        ✓ {syn.comp1} + {syn.comp2}
                      </p>
                    ))}
                  </div>
                )}
                {activeConflicts.length > 0 && (
                  <div className="border-red/20 text-footnote text-red mt-2 space-y-0.5 border-t pt-2">
                    <p className="font-semibold">Active Conflicts:</p>
                    {activeConflicts.map((con, idx) => (
                      <p key={idx}>
                        ⚠ {con.comp1} + {con.comp2}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
