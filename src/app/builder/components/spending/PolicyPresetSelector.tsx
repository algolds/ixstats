// PolicyPresetSelector Component
// Refactored from GovernmentSpendingSectionEnhanced.tsx
// Dialog for selecting policy presets to quickly configure government priorities

"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '~/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Sparkles } from 'lucide-react';
import { POLICY_PRESETS, type PolicyPresetKey } from '../../data/government-spending-policies';
import { toast } from 'sonner';

interface PolicyPresetSelectorProps {
  onApplyPreset: (policyIds: string[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * PolicyPresetSelector - Dialog for selecting policy configuration presets
 * Provides quick setup options for different government priorities
 */
export function PolicyPresetSelector({
  onApplyPreset,
  open,
  onOpenChange
}: PolicyPresetSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(open ?? false);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  };

  const handlePresetClick = (presetKey: PolicyPresetKey) => {
    const preset = POLICY_PRESETS[presetKey];
    onApplyPreset([...preset.policies]);
    handleOpenChange(false);

    toast.success(`Applied ${preset.name} policy preset`, {
      description: `${preset.policies.length} policies selected`
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="h-4 w-4 mr-2" />
          Policy Presets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Policy Presets</DialogTitle>
          <DialogDescription>
            Select a preset policy configuration to quickly set up your government's priorities
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {(Object.keys(POLICY_PRESETS) as PolicyPresetKey[]).map((presetKey) => {
            const preset = POLICY_PRESETS[presetKey];
            const Icon = preset.icon;

            return (
              <PresetCard
                key={presetKey}
                name={preset.name}
                description={preset.description}
                icon={Icon}
                color={preset.color}
                policyCount={preset.policies.length}
                onClick={() => handlePresetClick(presetKey)}
              />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * PresetCard - Individual preset option card
 */
function PresetCard({
  name,
  description,
  icon: Icon,
  color,
  policyCount,
  onClick
}: {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  policyCount: number;
  onClick: () => void;
}) {
  const colorClasses = {
    blue: 'hover:border-blue-500 text-blue-500',
    pink: 'hover:border-pink-500 text-pink-500',
    red: 'hover:border-red-500 text-red-500',
    green: 'hover:border-green-500 text-green-500',
    purple: 'hover:border-purple-500 text-purple-500'
  };

  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all ${colorClasses[color as keyof typeof colorClasses] || 'hover:border-primary'}`}
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-5 w-5 ${colorClasses[color as keyof typeof colorClasses]?.split(' ')[1] || 'text-primary'}`} />
          {name}
        </CardTitle>
        <CardDescription className="text-xs">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          {policyCount} {policyCount === 1 ? 'policy' : 'policies'} included
        </p>
      </CardContent>
    </Card>
  );
}
