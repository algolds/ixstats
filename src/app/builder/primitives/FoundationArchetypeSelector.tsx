"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Sparkles } from 'lucide-react';
import { cn } from '~/lib/utils';
import { EnhancedTooltip, InfoIcon } from '~/components/ui/enhanced-tooltip';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../components/glass/GlassCard';
import { archetypes, archetypeCategories, type CategorizedCountryArchetype } from '../utils/country-archetypes';
import type { RealCountryData } from '../lib/economy-data-service';

interface FoundationArchetypeSelectorProps {
  countries: RealCountryData[];
  selectedArchetype: string;
  onArchetypeSelect: (archetypeId: string) => void;
}

export function FoundationArchetypeSelector({
  countries,
  selectedArchetype,
  onArchetypeSelect
}: FoundationArchetypeSelectorProps) {
  if (!countries) {
    return <div>Loading countries...</div>; // Or some other placeholder
  }

  const filteredCountries = countries ? countries.filter(c => c.name !== "World") : [];

  return (
    <div className="relative z-20 mb-8">
      <GlassCard depth="elevated" motionPreset="slide" className="sticky top-0 z-30">
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">Foundation Archetypes</h3>
            <EnhancedTooltip className="text-[var(--color-text-primary)]"
              content="Archetypes are pre-defined categories to help you find countries that match your vision"
            >
              <InfoIcon className="text-[var(--color-text-primary)]" />
            </EnhancedTooltip>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
        

          {archetypeCategories.sort((a, b) => a.priority - b.priority).map(category => (
            <div key={category.id} className="mb-6">
              <h4 className={cn("text-lg font-semibold mb-3", category.color)}>{category.name}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-2">
                {archetypes
                  .filter(archetype => archetype.categoryId === category.id)
                  .sort((a, b) => a.priority - b.priority) // Assuming archetypes can have priority
                  .map((archetype: CategorizedCountryArchetype) => {
                    const Icon = archetype.icon;
                    const count = filteredCountries.filter(archetype.filter).length;
                    const isSelected = selectedArchetype === archetype.id;

                    return (
                      <motion.button
                        key={archetype.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onArchetypeSelect(archetype.id)}
                        className={cn(
                          'p-4 rounded-lg border transition-all duration-300 text-left',
                          `bg-gradient-to-br ${archetype.gradient}`,
                          isSelected
                            ? 'border-current shadow-lg bg-opacity-30'
                            : 'border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)]'
                        )}
                      >
                        <div className="flex items-center mb-2">
                          <Icon className={cn('h-6 w-6 mr-2', archetype.color)} />
                          <div className={cn('text-lg font-semibold', archetype.color)}>
                            {count}
                          </div>
                        </div>
                        <div className="text-sm text-[var(--color-text-secondary)] leading-tight">
                          {archetype.name}
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                          {archetype.description}
                        </div>
                        
                      </motion.button>
                    );
                  })}
              </div>
            </div>
          ))}
           <div className="mb-8">
            {/* All Countries */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onArchetypeSelect("all")}
              className={cn(
                'w-full p-4 rounded-lg border transition-all duration-300 flex items-center justify-center gap-2',
                'bg-gradient-to-br from-[var(--color-bg-secondary)]/20 to-[var(--color-bg-tertiary)]/20',
                selectedArchetype === "all"
                  ? 'border-blue-400/50 bg-blue-500/20 shadow-lg'
                  : 'border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)]'
              )}
            >
              <Globe className="h-6 w-6 text-blue-400" />
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {filteredCountries.length} All Countries
              </div>
            </motion.button>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
