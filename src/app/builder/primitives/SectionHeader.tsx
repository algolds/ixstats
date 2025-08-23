"use client";

import React from 'react';
import { Button } from '~/components/ui/button';
import { GlassTooltip, InfoIcon } from '../components/glass/GlassTooltip';
import type { Section } from '../types/builder';

interface SectionHeaderProps {
  section?: Section;
  title?: string;
  description?: string;
  icon?: React.ComponentType<any>;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

export function SectionHeader({
  section,
  title,
  description,
  icon,
  showAdvanced,
  onToggleAdvanced
}: SectionHeaderProps) {
  // Use section props if available, otherwise use individual props
  const sectionTitle = title || section?.name || 'Section';
  const sectionDescription = description || section?.description || '';
  const SectionIcon = icon || section?.icon;
  
  // Handle case where no icon is available
  if (!SectionIcon) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6" />
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">
              {sectionTitle}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {sectionDescription}
            </p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <SectionIcon className={`h-6 w-6 ${section?.color || 'text-slate-600 dark:text-slate-400'}`} />
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-white">{sectionTitle}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">{sectionDescription}</p>
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