"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Factory } from 'lucide-react';

// Sub-components
import {
  SectorTemplateSelector,
  SectorEditor,
  SectorMetrics,
  SectorVisualizations
} from './sectors';

// Utils and types
import { SECTOR_TEMPLATES, getSectorCategory, calculateSectorTotals } from './utils/sectorCalculations';
import type { EconomyBuilderState, SectorConfiguration } from '~/types/economy-builder';
import type { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import { ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';

/**
 * Props for the EconomySectorsTab component
 *
 * @interface EconomySectorsTabProps
 * @property {EconomyBuilderState} economyBuilder - Current economy builder state with sector configurations
 * @property {function} onEconomyBuilderChange - Callback to update economy builder when sector data changes
 * @property {EconomicComponentType[]} selectedComponents - Array of atomic economic components affecting sectors
 * @property {boolean} [showAdvanced=false] - Optional flag to display advanced sector configuration options
 */
interface EconomySectorsTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

/**
 * EconomySectorsTab - Economic sector configuration and management interface
 *
 * This component provides a comprehensive interface for building and managing a nation's economic sectors,
 * including primary (agriculture, mining), secondary (manufacturing, construction), and tertiary (services)
 * industries. It allows users to add sectors from templates, configure sector-specific metrics, and visualize
 * the overall sector composition with real-time validation and atomic component impact assessments.
 *
 * Key features:
 * - Template-based sector creation with pre-configured defaults for common industries
 * - Individual sector configuration (GDP contribution, employment share, productivity, growth rate)
 * - Automatic normalization to ensure sectors sum to 100% for GDP and employment
 * - Real-time visualization of sector distribution and metrics
 * - Component impact tracking shows how atomic economic components affect each sector
 * - Sector categorization (Primary, Secondary, Tertiary) for economic tier determination
 *
 * @component
 * @param {EconomySectorsTabProps} props - Component props
 * @param {EconomyBuilderState} props.economyBuilder - The economy builder state containing sector data
 * @param {function} props.onEconomyBuilderChange - Callback to update economy builder with sector modifications
 * @param {EconomicComponentType[]} props.selectedComponents - Atomic components that modify sector performance
 * @param {boolean} [props.showAdvanced=false] - Whether to show advanced sector configuration options
 *
 * @returns {JSX.Element} Rendered sector configuration interface with templates, editors, and visualizations
 *
 * @example
 * ```tsx
 * <EconomySectorsTab
 *   economyBuilder={economyBuilderState}
 *   onEconomyBuilderChange={handleEconomyChange}
 *   selectedComponents={['EXPORT_ORIENTED', 'INDUSTRIALIZATION']}
 *   showAdvanced={true}
 * />
 * ```
 */
export function EconomySectorsTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents,
  showAdvanced = false
}: EconomySectorsTabProps) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  // Calculate sector impacts from atomic components
  const sectorImpacts = useMemo(() => {
    const impacts: Record<string, number> = {};
    Object.keys(SECTOR_TEMPLATES).forEach((sectorId) => {
      let impact = 1.0;

      if (selectedComponents.length > 0) {
        // Multiply all component impacts together (multiplicative stacking)
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

  // Get the impact multiplier for a specific sector
  const getSectorImpact = (sectorId: string): number => {
    const sectorType = sectorId.split('_')[0];
    return sectorImpacts[sectorType] || 1.0;
  };

  // Get which components are affecting a specific sector
  const getAffectingComponents = (sectorId: string): Array<{ name: string; impact: number }> => {
    const sectorType = sectorId.split('_')[0];
    return selectedComponents
      .map(compType => {
        const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
        const impact = component?.sectorImpact[sectorType];
        if (impact && impact !== 1.0) {
          return {
            name: component.name,
            impact: impact
          };
        }
        return null;
      })
      .filter((item): item is { name: string; impact: number } => item !== null);
  };

  // Handle sector field changes
  const handleSectorChange = (
    sectorId: string,
    field: keyof SectorConfiguration,
    value: any
  ) => {
    const updatedSectors = economyBuilder.sectors.map((sector) => {
      if (sector.id === sectorId) {
        return { ...sector, [field]: value };
      }
      return sector;
    });

    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: updatedSectors
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

    const updatedSectors = economyBuilder.sectors.map((sector) => {
      const normalizedContribution = (sector.gdpContribution / totalGDP) * 100;
      const normalizedEmployment = (sector.employmentShare / totalEmployment) * 100;

      return {
        ...sector,
        gdpContribution: normalizedContribution,
        employmentShare: normalizedEmployment
      };
    });

    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: updatedSectors
    });
  };

  // Add new sector from template
  const addSector = (sectorType: string) => {
    const template = SECTOR_TEMPLATES[sectorType as keyof typeof SECTOR_TEMPLATES];
    const sectorId = `${sectorType}_${Date.now()}`;

    // Get the impact multiplier for this sector type
    const impact = sectorImpacts[sectorType] || 1.0;

    // Apply impact to base contribution values
    const baseGDP = template.baseContribution;
    const baseEmployment = template.baseContribution;

    const newSector: SectorConfiguration = {
      id: sectorId,
      name: template.name,
      category: getSectorCategory(sectorType),
      gdpContribution: baseGDP, // Store base value, display will show effective value
      employmentShare: baseEmployment, // Store base value, display will show effective value
      productivity: 75,
      growthRate: 2.0,
      exports: sectorType === 'manufacturing' ? 30 : sectorType === 'agriculture' ? 20 : 10,
      imports: sectorType === 'technology' ? 25 : 15,
      technologyLevel: 'Modern',
      automation: 20,
      regulation: 'Moderate',
      subsidy: sectorType === 'agriculture' ? 15 : 5,
      innovation: 50,
      sustainability: 70,
      competitiveness: 60
    };

    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: [...economyBuilder.sectors, newSector]
    });
  };

  // Remove sector
  const removeSector = (sectorId: string) => {
    const updatedSectors = economyBuilder.sectors.filter((sector) => sector.id !== sectorId);
    onEconomyBuilderChange({
      ...economyBuilder,
      sectors: updatedSectors
    });
  };

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <SectorMetrics sectors={economyBuilder.sectors} onNormalize={normalizeSectors} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Factory className="h-5 w-5" />
                <span>Active Sectors</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {economyBuilder.sectors.map((sector, index) => {
                const sectorType = sector.id.split('_')[0] as keyof typeof SECTOR_TEMPLATES;
                const impact = sectorImpacts[sectorType] || 1;
                const affectingComponents = getAffectingComponents(sector.id);
                const effectiveGDP = getEffectiveValue(sector.id, sector.gdpContribution);
                const effectiveEmployment = getEffectiveValue(sector.id, sector.employmentShare);

                return (
                  <SectorEditor
                    key={sector.id}
                    sector={sector}
                    index={index}
                    isSelected={selectedSector === sector.id}
                    showAdvanced={showAdvanced}
                    componentImpact={impact}
                    affectingComponents={affectingComponents}
                    effectiveGDP={effectiveGDP}
                    effectiveEmployment={effectiveEmployment}
                    onToggleSelect={() =>
                      setSelectedSector(selectedSector === sector.id ? null : sector.id)
                    }
                    onRemove={() => removeSector(sector.id)}
                    onChange={(field, value) => handleSectorChange(sector.id, field, value)}
                  />
                );
              })}
            </CardContent>
          </Card>

          {/* Template Selector */}
          <SectorTemplateSelector
            existingSectors={economyBuilder.sectors}
            onAddSector={addSector}
          />
        </div>

        {/* Visualizations */}
        <SectorVisualizations sectors={economyBuilder.sectors} sectorImpacts={sectorImpacts} />
      </div>
    </div>
  );
}
