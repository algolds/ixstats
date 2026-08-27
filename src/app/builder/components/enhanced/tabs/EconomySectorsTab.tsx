import React, { useState, useMemo } from "react";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  Settings,
  Search,
  Refresh as RefreshCw,
  CheckCircle,
  InfoCircle as Info,
} from "iconoir-react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";

// Sub-components
import { SectorCard, SectorMetrics, SectorVisualizations } from "./sectors";

// Utils and types
import {
  SECTOR_TEMPLATES,
  getSectorCategory,
  calculateSectorTotals,
  getSectorConstraints,
} from "./utils/sectorCalculations";
import { validateEconomy } from "./utils/validation";
import type { EconomyBuilderState, SectorConfiguration } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";

interface EconomySectorsTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

export function EconomySectorsTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents,
  showAdvanced = false,
}: EconomySectorsTabProps) {
  const [activeCategory, setActiveCategory] = useState<
    "all" | "primary" | "secondary" | "tertiary"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [localShowAdvanced, setLocalShowAdvanced] = useState(showAdvanced);

  // Calculate sector impacts from atomic components
  const sectorImpacts = useMemo(() => {
    const impacts: Record<string, number> = {};
    Object.keys(SECTOR_TEMPLATES).forEach((sectorId) => {
      let impact = 1.0;

      if (selectedComponents.length > 0) {
        impact = selectedComponents.reduce((multiplier, compType) => {
          const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
          const sectorMultiplier = component?.sectorImpact[sectorId] || 1.0;
          return multiplier * sectorMultiplier;
        }, 1.0);
      }

      impacts[sectorId] = impact;
    });
    return impacts;
  }, [selectedComponents]);

  // Compute sector constraints from selected components
  const sectorConstraints = useMemo(
    () => getSectorConstraints(selectedComponents),
    [selectedComponents]
  );

  const validation = useMemo(
    () => validateEconomy(economyBuilder, selectedComponents),
    [economyBuilder, selectedComponents]
  );

  // Get the impact multiplier for a specific sector
  const getSectorImpact = (sectorId: string): number => {
    const sectorType = sectorId.split("_")[0];
    return sectorImpacts[sectorType] || 1.0;
  };

  // Get which components are affecting a specific sector
  const getAffectingComponents = (sectorId: string): Array<{ name: string; impact: number }> => {
    const sectorType = sectorId.split("_")[0];
    return selectedComponents
      .map((compType) => {
        const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
        const impact = component?.sectorImpact[sectorType];
        if (impact && impact !== 1.0) {
          return {
            name: component.name,
            impact: impact,
          };
        }
        return null;
      })
      .filter((item): item is { name: string; impact: number } => item !== null);
  };

  // Handle sector field changes (realtime slider drags)
  const handleSectorChange = (sectorId: string, field: keyof SectorConfiguration, value: any) => {
    const updatedSectors = economyBuilder.sectors.map((sector) => {
      if (sector.id === sectorId) {
        return { ...sector, [field]: value };
      }
      return sector;
    });

    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: updatedSectors,
    });
  };

  // Get the effective (displayed) value with component impacts applied
  const getEffectiveValue = (sectorId: string, baseValue: number): number => {
    const impact = getSectorImpact(sectorId);
    return baseValue * impact;
  };

  // Normalize sectors to sum to 100%
  const normalizeSectors = () => {
    const { totalGDP, totalEmployment } = calculateSectorTotals(economyBuilder.sectors);
    if (totalGDP === 0 || totalEmployment === 0) return;

    const updatedSectors = economyBuilder.sectors.map((sector) => {
      const normalizedContribution = (sector.gdpContribution / totalGDP) * 100;
      const normalizedEmployment = (sector.employmentShare / totalEmployment) * 100;

      return {
        ...sector,
        gdpContribution: normalizedContribution,
        employmentShare: normalizedEmployment,
      };
    });

    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: updatedSectors,
    });
  };

  // Helper to normalize sectors array
  const performNormalization = (sectorsArray: SectorConfiguration[]): SectorConfiguration[] => {
    const { totalGDP, totalEmployment } = calculateSectorTotals(sectorsArray);
    if (totalGDP === 0 || totalEmployment === 0) return sectorsArray;

    return sectorsArray.map((sector) => ({
      ...sector,
      gdpContribution: (sector.gdpContribution / totalGDP) * 100,
      employmentShare: (sector.employmentShare / totalEmployment) * 100,
    }));
  };

  // Add new sector from template
  const addSector = (sectorType: string) => {
    const template = SECTOR_TEMPLATES[sectorType as keyof typeof SECTOR_TEMPLATES];
    const sectorId = `${sectorType}_${Date.now()}`;

    // Apply impact to base contribution values
    const baseGDP = template.baseContribution;
    const baseEmployment = template.baseContribution;

    const newSector: SectorConfiguration = {
      id: sectorId,
      name: template.name,
      category: getSectorCategory(sectorType),
      gdpContribution: baseGDP,
      employmentShare: baseEmployment,
      productivity: 75,
      growthRate: 2.0,
      exports: sectorType === "manufacturing" ? 30 : sectorType === "agriculture" ? 20 : 10,
      imports: sectorType === "technology" ? 25 : 15,
      technologyLevel: "Modern",
      automation: 20,
      regulation: "Moderate",
      subsidy: sectorType === "agriculture" ? 15 : 5,
      innovation: 50,
      sustainability: 70,
      competitiveness: 60,
    };

    const updatedSectors = [...economyBuilder.sectors, newSector];
    const normalizedSectors = performNormalization(updatedSectors);

    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: normalizedSectors,
    });
  };

  // Remove sector
  const removeSector = (sectorId: string) => {
    const updatedSectors = economyBuilder.sectors.filter((sector) => sector.id !== sectorId);
    if (updatedSectors.length === 0) {
      onEconomyBuilderChange({
        ...economyBuilder,
        sectors: [],
      });
      return;
    }
    const normalizedSectors = performNormalization(updatedSectors);
    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: normalizedSectors,
    });
  };

  // Toggle sector active/inactive status from grid click
  const toggleSector = (sectorType: string) => {
    const activeConfig = economyBuilder.sectors.find((s) => s.id.startsWith(sectorType));
    if (activeConfig) {
      removeSector(activeConfig.id);
    } else {
      addSector(sectorType);
    }
  };

  const { totalGDP, totalEmployment } = useMemo(() => {
    return calculateSectorTotals(economyBuilder.sectors);
  }, [economyBuilder.sectors]);

  const gdpValid = Math.abs(totalGDP - 100) < 1;
  const employmentValid = Math.abs(totalEmployment - 100) < 1;

  // Filter templates based on category & search query
  const filteredTemplates = useMemo(() => {
    return Object.entries(SECTOR_TEMPLATES).filter(([sectorType, template]) => {
      // 1. Category Filter
      if (activeCategory !== "all") {
        const cat = getSectorCategory(sectorType).toLowerCase();
        if (cat !== activeCategory) return false;
      }
      // 2. Search Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = template.name.toLowerCase().includes(query);
        const matchesDesc = template.description.toLowerCase().includes(query);
        const matchesChar = template.characteristics.some((c) => c.toLowerCase().includes(query));
        return matchesName || matchesDesc || matchesChar;
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 1. Metrics Overview */}
      <SectorMetrics
        sectors={economyBuilder.sectors}
        onNormalize={normalizeSectors}
        hasZeroContribution={validation.hasZeroContribution}
      />

      {/* 3. Search & Grid Selector (Component UX style) */}
      <GlassCard depth="base" theme="emerald" className="border-emerald-500/10">
        <GlassCardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-4 border-b border-white/5 pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <Tabs value={activeCategory} onValueChange={(val: any) => setActiveCategory(val)}>
                <TabsList className="border border-white/10 bg-white/5 p-0.5">
                  <TabsTrigger value="all" className="text-xs">
                    All Sectors
                  </TabsTrigger>
                  <TabsTrigger value="primary" className="text-xs">
                    Primary
                  </TabsTrigger>
                  <TabsTrigger value="secondary" className="text-xs">
                    Secondary
                  </TabsTrigger>
                  <TabsTrigger value="tertiary" className="text-xs">
                    Tertiary
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <label className="flex cursor-pointer items-center gap-2 border-l border-white/10 pl-4 text-xs text-zinc-400 select-none">
                <input
                  type="checkbox"
                  checked={localShowAdvanced}
                  onChange={(e) => setLocalShowAdvanced(e.target.checked)}
                  className="rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500/20"
                />
                Show Advanced Settings
              </label>

              {economyBuilder.sectors.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={normalizeSectors}
                  className="h-8 border-emerald-500/20 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Normalize Ratios
                </Button>
              )}
            </div>

            <div className="relative w-full max-w-xs">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search sectors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-foreground placeholder:text-muted-foreground w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pr-4 pl-9 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map(([sectorType, template]) => {
              const activeConfig = economyBuilder.sectors.find((s) => s.id.startsWith(sectorType));
              const constraint = sectorConstraints[sectorType];
              const isLocked = !!(constraint?.locked && !activeConfig);

              return (
                <SectorCard
                  key={sectorType}
                  sectorId={sectorType}
                  template={template}
                  isActive={!!activeConfig}
                  isLocked={isLocked}
                  lockedBy={constraint?.lockedBy || []}
                  isRecommended={constraint?.recommended || false}
                  recommendedBy={constraint?.recommendedBy || []}
                  activeConfig={activeConfig}
                  onToggle={() => toggleSector(sectorType)}
                  showAdvanced={localShowAdvanced}
                  componentImpact={getSectorImpact(sectorType)}
                  affectingComponents={activeConfig ? getAffectingComponents(activeConfig.id) : []}
                  effectiveGDP={
                    activeConfig
                      ? getEffectiveValue(activeConfig.id, activeConfig.gdpContribution)
                      : undefined
                  }
                  effectiveEmployment={
                    activeConfig
                      ? getEffectiveValue(activeConfig.id, activeConfig.employmentShare)
                      : undefined
                  }
                  constraint={constraint}
                  onChange={(field, value) =>
                    activeConfig && handleSectorChange(activeConfig.id, field, value)
                  }
                  onCommit={() => normalizeSectors()}
                />
              );
            })}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* 4. Active Configuration Area & Visualizations (Two Columns layout) */}
      {economyBuilder.sectors.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Analysis & Insights Alert Box (Left 2 cols) */}
          <div className="space-y-6 lg:col-span-2">
            <Alert className="border-2 border-emerald-500/20 bg-emerald-500/[0.02]">
              <Info className="h-4 w-4 text-emerald-400" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="text-foreground text-xs font-medium">
                    Sectors Analysis & Rationale:
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-[11px] text-zinc-400">
                    {gdpValid && employmentValid ? (
                      <li className="text-emerald-400">
                        ✓ Ratios perfectly balanced! Rationale checks out.
                      </li>
                    ) : (
                      <li className="text-amber-400">
                        ⚠ GDP and Employment metrics do not sum to 100%. Click "Normalize Ratios" to
                        auto-balance.
                      </li>
                    )}
                    {economyBuilder.sectors.length >= 3 && (
                      <li className="text-emerald-400">
                        ✓ Healthy sector diversity: {economyBuilder.sectors.length} sectors active.
                      </li>
                    )}
                    {economyBuilder.sectors.length < 3 && (
                      <li className="text-amber-400">
                        ⚠ Low sector diversity. Consider activating primary, secondary, and tertiary
                        sectors for a balanced build.
                      </li>
                    )}
                    {economyBuilder.sectors.some(
                      (s) => s.id.startsWith("technology") && s.automation > 50
                    ) && (
                      <li className="text-emerald-400">
                        ✓ Technology sector is highly automated, boosting productivity.
                      </li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </div>

          {/* Visualizations (Right 1 col) */}
          <div className="lg:col-span-1">
            <SectorVisualizations sectors={economyBuilder.sectors} sectorImpacts={sectorImpacts} />
          </div>
        </div>
      )}
    </div>
  );
}
