"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { cn } from '~/lib/utils';
import { GlassCard, GlassCardContent, GlassCardHeader } from '../components/glass/GlassCard';
import { LiquidGlassIndicator } from '../components/ui/LiquidGlassIndicator';
import type { Section } from '../types/builder';

interface SectionNavigatorProps {
  sections: Section[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

export function SectionNavigator({
  sections,
  activeSection,
  onSectionChange
}: SectionNavigatorProps) {
  return (
    <GlassCard depth="elevated" blur="medium">
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-[var(--color-text-primary)]" />
          <h3 className="font-semibold text-[var(--color-text-primary)]">Sections</h3>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <motion.button
                key={section.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  'w-full p-3 rounded-lg border text-left transition-all duration-200',
                  isActive
                    ? 'bg-[var(--color-bg-accent)] border-[var(--color-border-secondary)] shadow-lg'
                    : 'border-[var(--color-border-primary)] hover:bg-[var(--color-bg-accent)]/50 hover:border-[var(--color-border-secondary)]'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={cn('h-5 w-5', section.color)} />
                  <span className="font-medium text-[var(--color-text-primary)]">{section.name}</span>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] mb-2">{section.description}</p>
                <div className="flex items-center gap-3">
                  <LiquidGlassIndicator 
                    percentage={section.completeness}
                    color={section.color}
                    size="sm"
                    className="flex-1"
                  />
                  <span className="text-xs text-[var(--color-text-muted)] font-medium">{section.completeness}%</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}