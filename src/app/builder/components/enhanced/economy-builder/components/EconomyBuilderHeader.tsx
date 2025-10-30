"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  HelpCircle,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  Loader2,
  Target,
  Atom,
  BarChart3,
  Users,
  TrendingUp,
  DollarSign,
  Gauge,
} from "lucide-react";
import { cn } from "~/lib/utils";

interface EconomyBuilderHeaderProps {
  isLoadingConfig: boolean;
  isAutoSaveEnabled: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  validationStatus: {
    isValid: boolean;
    hasWarnings: boolean;
    errorCount: number;
    warningCount: number;
  };
  onPresetsClick: () => void;
}

export function EconomyBuilderHeader({
  isLoadingConfig,
  isAutoSaveEnabled,
  hasUnsavedChanges,
  lastSaved,
  validationStatus,
  onPresetsClick,
}: EconomyBuilderHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-foreground text-3xl font-bold">MyEconomy</h1>
        <p className="text-muted-foreground mt-1">Configure your nation's economy and tax system</p>

        <div className="mt-2 flex items-center gap-4">
          {isLoadingConfig && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading configuration...</span>
            </div>
          )}

          {isAutoSaveEnabled && (
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  hasUnsavedChanges ? "animate-spin text-amber-600" : "text-green-600"
                )}
              />
              <span className={cn(hasUnsavedChanges ? "text-amber-600" : "text-green-600")}>
                {hasUnsavedChanges ? "Auto-save pending..." : "Auto-save enabled"}
              </span>
            </div>
          )}

          {lastSaved && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Last saved: {new Date(lastSaved).toLocaleTimeString()}</span>
            </div>
          )}

          {validationStatus && (
            <div className="flex items-center gap-2">
              {validationStatus.isValid ? (
                <Badge variant="outline" className="border-green-600 text-green-600">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Valid
                </Badge>
              ) : (
                <Badge variant="outline" className="border-red-600 text-red-600">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {validationStatus.errorCount} errors
                </Badge>
              )}
              {validationStatus.hasWarnings && (
                <Badge variant="outline" className="border-amber-600 text-amber-600">
                  <Info className="mr-1 h-3 w-3" />
                  {validationStatus.warningCount} warnings
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              Help
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-6 w-6 text-blue-600" />
                Economy Builder Guide
              </DialogTitle>
              <DialogDescription>
                Complete guide to building and managing your nation's economy
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 text-sm">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <Target className="h-5 w-5 text-blue-600" />
                  Getting Started
                </h3>
                <p className="text-muted-foreground mb-2">
                  The Economy Builder follows a 6-step process to create a complete economic profile
                  for your nation:
                </p>
                <ol className="text-muted-foreground ml-2 list-inside list-decimal space-y-2">
                  <li>
                    <strong>Economic Components:</strong> Select atomic components that define your
                    economic philosophy
                  </li>
                  <li>
                    <strong>Economic Sectors:</strong> Set up your primary industries
                  </li>
                  <li>
                    <strong>Labor & Employment:</strong> Configure workforce distribution and labor
                    rights
                  </li>
                  <li>
                    <strong>Demographics:</strong> Define population characteristics and growth
                    rates
                  </li>
                  <li>
                    <strong>Tax System:</strong> Build your taxation structure
                  </li>
                  <li>
                    <strong>Preview:</strong> Review all settings and save your configuration
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <Atom className="h-5 w-5 text-green-600" />
                  Atomic Economic Components
                </h3>
                <p className="text-muted-foreground mb-2">
                  Components are modular building blocks that define your economic system.
                </p>
                <ul className="text-muted-foreground ml-2 list-inside list-disc space-y-2">
                  <li>
                    <strong>Select up to 12 components</strong> that represent your economic vision
                  </li>
                  <li>
                    <strong>Green badges (synergies):</strong> Components that work well together
                  </li>
                  <li>
                    <strong>Red badges (conflicts):</strong> Components that contradict each other
                  </li>
                  <li>
                    <strong>Use Presets button</strong> to quick-start with common archetypes
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  Pro Tips
                </h3>
                <ul className="text-muted-foreground space-y-2 text-xs">
                  <li>
                    <strong>Start with Presets:</strong> Use economic archetypes as templates, then
                    customize
                  </li>
                  <li>
                    <strong>Balance vs. Specialization:</strong> Diverse sectors = stability,
                    focused = competitive advantages
                  </li>
                  <li>
                    <strong>Watch Conflicts:</strong> Avoid major contradictions between components
                  </li>
                  <li>
                    <strong>Preview Before Saving:</strong> Always review the complete configuration
                  </li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm" onClick={onPresetsClick}>
          <Sparkles className="mr-2 h-4 w-4" />
          Presets
        </Button>
      </div>
    </div>
  );
}
