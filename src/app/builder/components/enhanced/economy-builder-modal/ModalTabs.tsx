"use client";

import React from 'react';
import { TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Zap, Factory, Users, BarChart3, Target, type LucideIcon } from 'lucide-react';
import type { EconomyBuilderTab } from '~/types/economy-builder';

const TAB_CONFIG: Array<{ id: EconomyBuilderTab; label: string; icon: LucideIcon }> = [
  { id: 'atomicComponents', label: 'Atomic Components', icon: Zap },
  { id: 'sectors', label: 'Sectors', icon: Factory },
  { id: 'labor', label: 'Labor & Employment', icon: Users },
  { id: 'demographics', label: 'Demographics', icon: BarChart3 },
  { id: 'preview', label: 'Preview', icon: Target }
];

interface ModalTabsProps {
  activeTab: EconomyBuilderTab;
}

export function ModalTabs({ activeTab }: ModalTabsProps) {
  return (
    <div className="px-6 py-3 border-b bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
      <TabsList className="grid w-full grid-cols-5">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center space-x-2">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
