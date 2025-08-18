"use client";

import React from 'react';
import { Button } from '~/components/ui/button';
import { GlassTooltip, InfoIcon } from '../components/glass/GlassTooltip';
import type { Section } from '../types/builder';

interface SectionHeaderProps {
  section: Section;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

export function SectionHeader({
  section,
  showAdvanced,
  onToggleAdvanced
}: SectionHeaderProps) {
  const Icon = section.icon;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 ${section.color}`} />
        <div>
          <h3 className="font-semibold text-[var(--color-text-primary)]">{section.name}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">{section.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={onToggleAdvanced}
          variant="outline"
          size="sm"
          className="bg-[var(--color-bg-accent)] border-[var(--color-border-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-accent)]/80"
        >
          {showAdvanced ? 'Basic' : 'Advanced'}
        </Button>
        <GlassTooltip
          content="Get detailed explanations and impact analysis for each parameter"
          position="left"
        >
          <InfoIcon />
        </GlassTooltip>
      </div>
    </div>
  );
}