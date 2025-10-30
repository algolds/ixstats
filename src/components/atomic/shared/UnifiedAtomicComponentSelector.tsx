"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { CheckCircle, AlertCircle, Info, Plus, Minus, TrendingUp, Search } from "lucide-react";
import { cn } from "~/lib/utils";
import type { UnifiedAtomicComponentSelectorProps } from "./types";
import { UnifiedAtomicCard } from "./UnifiedAtomicCard";
import { getThemeColorClasses } from "./themes";

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
  const [activeCategory, setActiveCategory] = useState<string>(Object.keys(categories)[0] || "");
  const [searchQuery, setSearchQuery] = useState("");

  const effectiveness = useMemo(
    () => calculateEffectiveness(selectedComponents),
    [selectedComponents, calculateEffectiveness]
  );

  const themeClasses = getThemeColorClasses(theme, activeCategory);

  const toggleComponent = (componentId: string) => {
    if (isReadOnly) return;

    if (selectedComponents.includes(componentId as T)) {
      onComponentChange(selectedComponents.filter((c) => c !== componentId));
    } else if (selectedComponents.length < maxComponents) {
      onComponentChange([...selectedComponents, componentId as T]);
    }
  };

  const totalImplementationCost = selectedComponents.reduce(
    (sum, id) => sum + (components[id]?.implementationCost || 0),
    0
  );

  const totalMaintenanceCost = selectedComponents.reduce(
    (sum, id) => sum + (components[id]?.maintenanceCost || 0),
    0
  );

  const filteredComponents = useMemo(() => {
    const categoryComponents = categories[activeCategory] || [];
    if (!searchQuery) return categoryComponents;

    return categoryComponents.filter((id) => {
      const component = components[id];
      return (
        component?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        component?.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [activeCategory, searchQuery, categories, components]);

  return (
    <Card className="glass-card-parent w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-lg border p-2 backdrop-blur-sm",
                `bg-gradient-to-br from-${themeClasses.primaryLight}/20 to-${themeClasses.primaryDark}/20`,
                `border-${themeClasses.primaryLight}/30`
              )}
            >
              <SystemIcon className={cn("h-5 w-5", `text-${themeClasses.primary}`)} />
            </div>
            <div>
              <CardTitle className="text-foreground">{systemName}</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Build your system using modular components with synergies and conflicts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={cn("text-2xl font-bold", `text-${themeClasses.primary}`)}>
                {effectiveness.totalEffectiveness.toFixed(0)}
              </div>
              <div className="text-muted-foreground text-xs">Effectiveness</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                +{effectiveness.synergyBonus.toFixed(0)}
              </div>
              <div className="text-muted-foreground text-xs">Synergies</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                -{effectiveness.conflictPenalty.toFixed(0)}
              </div>
              <div className="text-muted-foreground text-xs">Conflicts</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground font-medium">
              Components: {selectedComponents.length} / {maxComponents}
            </span>
            <span className="text-muted-foreground">
              {((selectedComponents.length / maxComponents) * 100).toFixed(0)}%
            </span>
          </div>
          <Progress value={(selectedComponents.length / maxComponents) * 100} className="h-2" />
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/20 w-full rounded-lg border py-2 pr-4 pl-10 focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="bg-muted/50 grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Object.keys(categories).map((category) => (
              <TabsTrigger
                key={category}
                value={category}
                className="data-[state=active]:bg-background data-[state=active]:text-foreground text-xs"
              >
                <span className="hidden md:inline">{category}</span>
                <span className="md:hidden">{category.split(" ")[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(categories).map(([category, componentIds]) => (
            <TabsContent key={category} value={category} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                        onToggle={() => toggleComponent(componentId)}
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
          <div className="bg-muted/30 space-y-4 rounded-lg p-4 backdrop-blur-sm">
            <h4 className="text-foreground flex items-center gap-2 font-semibold">
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
                      "flex items-center gap-1 text-white",
                      `bg-${themeClasses.primary}`
                    )}
                  >
                    {component.name}
                    {!isReadOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComponent(componentId);
                        }}
                        className="ml-1 rounded-full p-0.5 transition-colors hover:bg-red-500"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>

            {/* System Metrics */}
            <div className="border-border/50 grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-foreground text-lg font-bold">
                  {effectiveness.totalEffectiveness.toFixed(0)}%
                </div>
                <div className="text-muted-foreground text-xs">Total Effectiveness</div>
              </div>

              <div className="text-center">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {effectiveness.synergyCount}
                </div>
                <div className="text-muted-foreground text-xs">Active Synergies</div>
              </div>

              <div className="text-center">
                <div className={cn("text-lg font-bold", `text-${themeClasses.primary}`)}>
                  ${(totalImplementationCost / 1000).toFixed(0)}k
                </div>
                <div className="text-muted-foreground text-xs">Implementation Cost</div>
              </div>

              <div className="text-center">
                <div className={cn("text-lg font-bold", `text-${themeClasses.primary}`)}>
                  ${(totalMaintenanceCost / 1000).toFixed(0)}k
                </div>
                <div className="text-muted-foreground text-xs">Annual Cost</div>
              </div>
            </div>
          </div>
        )}

        {/* System Analysis */}
        {selectedComponents.length > 0 && (
          <Alert
            className={cn(
              "border-2",
              `border-${themeClasses.primaryLight}/30`,
              `bg-${themeClasses.selectedBg}/50`,
              `dark:bg-${themeClasses.selectedBgDark}`
            )}
          >
            <Info className={cn("h-4 w-4", `text-${themeClasses.primary}`)} />
            <AlertDescription>
              <div className="space-y-2">
                <p className="text-foreground font-medium">System Analysis:</p>
                <ul className="space-y-1 text-sm">
                  {effectiveness.synergyCount > effectiveness.conflictCount && (
                    <li className="text-green-700 dark:text-green-400">
                      ✓ Strong component synergies detected - system efficiency increased by{" "}
                      {effectiveness.synergyBonus.toFixed(0)}%
                    </li>
                  )}
                  {effectiveness.conflictCount > 0 && (
                    <li className="text-red-700 dark:text-red-400">
                      ⚠ {effectiveness.conflictCount} conflict(s) detected - effectiveness reduced
                      by {effectiveness.conflictPenalty.toFixed(0)}%
                    </li>
                  )}
                  {effectiveness.baseEffectiveness > 85 && (
                    <li className="text-green-700 dark:text-green-400">
                      ✓ High-effectiveness components selected (avg{" "}
                      {effectiveness.baseEffectiveness.toFixed(0)}%)
                    </li>
                  )}
                  {effectiveness.baseEffectiveness < 75 && (
                    <li className="text-yellow-700 dark:text-yellow-400">
                      ⚠ Consider adding higher effectiveness components
                    </li>
                  )}
                  {totalImplementationCost > 1000000 && (
                    <li className="text-yellow-700 dark:text-yellow-400">
                      ⚠ High implementation costs - consider phased rollout
                    </li>
                  )}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
