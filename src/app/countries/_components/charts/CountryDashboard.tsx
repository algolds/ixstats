// src/app/countries/_components/charts/CountryDashboard.tsx
import React, { useRef, useEffect, useState } from 'react';
import type { ChartType } from "../detail";
import {
  PopulationCategory,
  EconomyCategory,
  GovernmentCategory,
  SocietyCategory,
  GlobalRankCategory
} from "../categories";
import { cn } from "~/lib/utils";

interface CountryData {
  currentPopulation: number;
  populationGrowthRate: number;
  populationTier: string;
  populationDensity?: number | null;
  landArea?: number | null;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  adjustedGdpGrowth: number;
  economicTier: string;
  governmentType?: string | null;
  leader?: string | null;
  religion?: string | null;
}

interface CountryDashboardProps {
  country: CountryData;
  onNavigate: (view: ChartType) => void;
}

export function CountryDashboard({ country, onNavigate }: CountryDashboardProps) {
  const categoryRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(0); // Default focus to the first item

  const categoriesConfig = [
    {
      id: 'population',
      Comp: PopulationCategory,
      data: {
        currentPopulation: country.currentPopulation,
        populationGrowthRate: country.populationGrowthRate,
        populationTier: country.populationTier,
        populationDensity: country.populationDensity,
        landArea: country.landArea,
      },
      onClickArg: 'population' as ChartType
    },
    {
      id: 'economy',
      Comp: EconomyCategory,
      data: {
        currentGdpPerCapita: country.currentGdpPerCapita,
        currentTotalGdp: country.currentTotalGdp,
        adjustedGdpGrowth: country.adjustedGdpGrowth,
        economicTier: country.economicTier,
      },
      onClickArg: 'gdp' as ChartType
    },
    {
      id: 'government',
      Comp: GovernmentCategory,
      data: {
        governmentType: country.governmentType,
        leader: country.leader,
        populationTier: country.populationTier,
      },
      onClickArg: 'overview' as ChartType // Or a specific 'government' view if created
    },
    {
      id: 'society',
      Comp: SocietyCategory,
      data: {
        religion: country.religion,
        economicTier: country.economicTier,
        populationTier: country.populationTier,
        currentGdpPerCapita: country.currentGdpPerCapita,
      },
      onClickArg: 'overview' as ChartType // Or a specific 'society' view
    },
    {
      id: 'rank',
      Comp: GlobalRankCategory,
      data: {
        economicTier: country.economicTier,
        populationTier: country.populationTier,
        currentTotalGdp: country.currentTotalGdp,
        currentPopulation: country.currentPopulation,
      },
      onClickArg: 'overview' as ChartType // Or a specific 'rank' view
    },
  ];

  useEffect(() => {
    categoryRefs.current = categoryRefs.current.slice(0, categoriesConfig.length);
  }, [categoriesConfig.length]);

  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < categoryRefs.current.length && categoryRefs.current[focusedIndex]) {
      categoryRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let newIndex = focusedIndex;
    if (event.key === 'ArrowRight') {
      newIndex = (focusedIndex + 1) % categoriesConfig.length;
      event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      newIndex = (focusedIndex - 1 + categoriesConfig.length) % categoriesConfig.length;
      event.preventDefault();
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (focusedIndex >= 0 && focusedIndex < categoriesConfig.length) {
        const category = categoriesConfig[focusedIndex];
        if (category) {
            onNavigate(category.onClickArg);
        }
        event.preventDefault();
      }
      return; // Return early to avoid setFocusedIndex if not changed
    } else {
      return; // Not an arrow, enter, or space key
    }
    setFocusedIndex(newIndex);
  };
  
  // Determine the number of columns for grid layout
  const numCols = categoriesConfig.length;
  const colClass = numCols === 5 ? 'md:grid-cols-5' : 
                   numCols === 4 ? 'md:grid-cols-4' :
                   numCols === 3 ? 'md:grid-cols-3' :
                   'md:grid-cols-2'; // Default or for fewer items

  return (
    <div
      className={cn("grid grid-cols-2 gap-3 md:gap-4 mb-6", colClass)}
      onKeyDown={handleKeyDown}
      role="toolbar"
      aria-label="Country Categories"
    >
      {categoriesConfig.map((cat, index) => (
        <div
          key={cat.id}
          ref={(el: HTMLDivElement | null) => {
            categoryRefs.current[index] = el;
          }}
          tabIndex={focusedIndex === index ? 0 : -1}
          role="button"
          aria-pressed={focusedIndex === index}
          className={cn(
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg",
             // Ensure the Card itself doesn't have conflicting focus styles or use a wrapper
          )}
          onFocus={() => setFocusedIndex(index)} // Update focus state if focused by other means (e.g. mouse click then tabbing)
          onClick={() => { // Allow click to also set focus and navigate
            setFocusedIndex(index);
            onNavigate(cat.onClickArg);
          }}
        >
          <cat.Comp
            data={cat.data as any} // Cast because data structures vary
            // onClick is handled by the parent div now for unified keyboard/mouse action
            className={cn("h-full", { // Example: add visual indication of focus on the card itself
                // "ring-2 ring-primary ring-offset-1": focusedIndex === index 
            })}
          />
        </div>
      ))}
    </div>
  );
}