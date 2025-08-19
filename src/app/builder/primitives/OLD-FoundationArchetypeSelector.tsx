"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Sparkles } from 'lucide-react';
import { cn } from '~/lib/utils';
import { EnhancedTooltip, InfoIcon } from '~/components/ui/enhanced-tooltip';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../components/glass/GlassCard';
import { archetypes } from '../utils/country-archetypes';
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
  const filteredCountries = countries.filter(c => c.name !== "World");

  return (
    <div className="relative z-20 mb-8">
      <GlassCard depth="elevated" motionPreset="slide" className="sticky top-0 z-30">
        <GlassCardHeader>
          <div className="flex items-center gap-2 justify-center">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">Foundation Archetypes</h3>
            <EnhancedTooltip
              content="Pre-defined categories to help you find countries that match your vision"
              position="top"
            >
              <InfoIcon />
            </EnhancedTooltip>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* All Countries */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onArchetypeSelect("all")}
              className={cn(
                'p-4 rounded-lg border transition-all duration-300',
                'bg-gradient-to-br from-[var(--color-bg-secondary)]/20 to-[var(--color-bg-tertiary)]/20',
                selectedArchetype === "all"
                  ? 'border-blue-400/50 bg-blue-500/20 shadow-lg'
                  : 'border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)]'
              )}
            >
              <Globe className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {filteredCountries.length}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">All Countries</div>
            </motion.button>

            {/* Archetype Cards */}
            {archetypes.map((archetype) => {
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
                    'p-4 rounded-lg border transition-all duration-300',
                    `bg-gradient-to-br ${archetype.gradient}`,
                    isSelected
                      ? 'border-current shadow-lg bg-opacity-30'
                      : 'border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)]'
                  )}
                >
                  <Icon className={cn('h-6 w-6 mx-auto mb-2', archetype.color)} />
                  <div className={cn('text-lg font-semibold', archetype.color)}>
                    {count}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)] leading-tight">
                    {archetype.name}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}