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
          <h3 className="font-semibold text-slate-800 dark:text-white">{section.name}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">{section.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={onToggleAdvanced}
          variant="outline"
          size="sm"
          className="bg-white/10 border-white/20 text-slate-800 dark:text-white hover:bg-white/15"
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