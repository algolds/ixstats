// Core Step - National identity and core indicators for Atomic Builder
// Extracted from AtomicBuilderPageEnhanced.tsx for modularity

"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Flag, BarChart3, Info, HelpCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import { stepConfig } from '../builderConfig';
import {
  NationalIdentitySection,
  CoreIndicatorsSection,
} from '~/app/builder/sections';
import type { RealCountryData, EconomicInputs } from '~/app/builder/lib/economy-data-service';

interface CoreStepProps {
  economicInputs: EconomicInputs | null;
  selectedCountry: RealCountryData | null;
  showAdvancedMode: boolean;
  activeCoreTab: string;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
  onTabChange: (tab: string) => void;
}

// Enhanced tab trigger component
function EnhancedTabsTrigger({
  children,
  icon: Icon,
  badge,
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger> & {
  icon?: React.ElementType;
  badge?: string | number;
}) {
  return (
    <TabsTrigger
      className={cn(
        "relative flex flex-col gap-1.5 p-3 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200",
        "hover:bg-background/50",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        {Icon && React.createElement(Icon, { className: "h-4 w-4" })}
      </div>
      <span className="text-xs font-medium">{children}</span>
      {badge !== undefined && (
        <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]">
          {badge}
        </Badge>
      )}
    </TabsTrigger>
  );
}

// Help tooltip component
function HelpTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CoreStep({
  economicInputs,
  selectedCountry,
  showAdvancedMode,
  activeCoreTab,
  onEconomicInputsChange,
  onTabChange
}: CoreStepProps) {
  if (!economicInputs) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing core foundation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-lg mb-4">
          <Flag className="h-8 w-8 text-white" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-3xl font-bold">Core Foundation</h2>
          <HelpTooltip text={stepConfig.core.help} />
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Configure national identity and economic fundamentals{selectedCountry ? ` for ${selectedCountry.name}` : ' from scratch'}
        </p>
      </motion.div>

      <Alert className="border-amber-200/50 bg-amber-50/30 backdrop-blur-sm">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Foundation Setup:</strong> Define your nation's identity and core economic indicators.
          These values will automatically adjust other economic parameters throughout the builder.
        </AlertDescription>
      </Alert>

      <Tabs value={activeCoreTab} onValueChange={onTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50 backdrop-blur-sm border border-border/50 p-1 rounded-xl">
          <EnhancedTabsTrigger
            value="identity"
            icon={Flag}
          >
            National Identity
          </EnhancedTabsTrigger>
          <EnhancedTabsTrigger
            value="indicators"
            icon={BarChart3}
          >
            Core Indicators
          </EnhancedTabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <NationalIdentitySection
              inputs={economicInputs}
              onInputsChange={onEconomicInputsChange}
              referenceCountry={selectedCountry}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="indicators" className="mt-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <CoreIndicatorsSection
              inputs={economicInputs}
              onInputsChange={onEconomicInputsChange}
              showAdvanced={showAdvancedMode}
              referenceCountry={selectedCountry}
            />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
