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
  showSuccessAnimation: boolean;
  validationStatus: {
    isValid: boolean;
    hasWarnings: boolean;
    errorCount: number;
    warningCount: number;
  } | null;
  onPresetsClick: () => void;
}

export function EconomyBuilderHeader({
  isLoadingConfig,
  isAutoSaveEnabled,
  hasUnsavedChanges,
  lastSaved,
  showSuccessAnimation,
  validationStatus,
  onPresetsClick,
}: EconomyBuilderHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-foreground text-3xl font-bold">MyEconomy</h1>
        <p className="text-muted-foreground mt-1">
          Configure your nation's economic systems and tax policies
        </p>

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

          {showSuccessAnimation && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Autosaved!</span>
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
                    economic philosophy (Free Market, Planned, etc.)
                  </li>
                  <li>
                    <strong>Economic Sectors:</strong> Set up your primary industries (Agriculture,
                    Manufacturing, Services, etc.)
                  </li>
                  <li>
                    <strong>Labor & Employment:</strong> Configure workforce distribution,
                    unemployment, and labor rights
                  </li>
                  <li>
                    <strong>Demographics:</strong> Define population characteristics, age
                    distribution, and growth rates
                  </li>
                  <li>
                    <strong>Tax System:</strong> Build your taxation structure with brackets,
                    categories, and policies
                  </li>
                  <li>
                    <strong>Preview:</strong> Review all settings and save your complete economic
                    configuration
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <Atom className="h-5 w-5 text-green-600" />
                  Atomic Economic Components
                </h3>
                <p className="text-muted-foreground mb-2">
                  Components are modular building blocks that define your economic system. Each
                  represents a specific philosophy or policy.
                </p>
                <ul className="text-muted-foreground ml-2 list-inside list-disc space-y-2">
                  <li>
                    <strong>Select up to 12 components</strong> that best represent your economic
                    vision
                  </li>
                  <li>
                    <strong>Green badges (synergies):</strong> Components that work well together
                    and boost effectiveness
                  </li>
                  <li>
                    <strong>Red badges (conflicts):</strong> Components that contradict and reduce
                    efficiency
                  </li>
                  <li>
                    <strong>★ Star:</strong> Active synergy (both components selected)
                  </li>
                  <li>
                    <strong>⚠ Warning:</strong> Active conflict (creates inefficiency)
                  </li>
                  <li>
                    <strong>Use Presets button</strong> to quick-start with common economic
                    archetypes
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Economic Sectors
                </h3>
                <p className="text-muted-foreground">
                  Define your primary, secondary, and tertiary industries. Your sector distribution
                  affects GDP composition, employment patterns, and economic development tier
                  (Developing → Emerging → Developed → Advanced). Balanced sectors create economic
                  stability, while specialized economies excel in specific areas.
                </p>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <Users className="h-5 w-5 text-emerald-600" />
                  Labor & Employment
                </h3>
                <p className="text-muted-foreground">
                  Set employment rates, workforce distribution across sectors, minimum wage, and
                  working conditions. These settings interact with your economic components - for
                  example, "Strong Labor Unions" increases worker protections but may reduce
                  business flexibility. Balance employment metrics with your economic philosophy.
                </p>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                  Demographics & Population
                </h3>
                <p className="text-muted-foreground">
                  Configure total population, age distribution, growth rates, and urbanization
                  levels. Demographics directly influence labor supply, consumer markets, and social
                  program costs. Aging populations require different policies than young, growing
                  populations.
                </p>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <DollarSign className="h-5 w-5 text-red-600" />
                  Tax System Integration
                </h3>
                <p className="text-muted-foreground">
                  The tax builder auto-populates based on your economic data (GDP, sectors,
                  employment). It recommends progressive/flat taxation based on your components,
                  suggests brackets by income distribution, and links to government departments. Tax
                  policy affects economic growth, inequality, and business investment.
                </p>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <Gauge className="h-5 w-5 text-blue-600" />
                  Effectiveness & Synergies
                </h3>
                <p className="text-muted-foreground mb-2">
                  Your overall economic effectiveness is calculated from:
                </p>
                <ul className="text-muted-foreground ml-4 list-inside list-disc space-y-1">
                  <li>Average effectiveness of selected components</li>
                  <li>Internal synergies (+10 pts each)</li>
                  <li>Government cross-builder synergies (+15 pts each)</li>
                  <li>Internal conflicts (-10 pts each)</li>
                  <li>Government conflicts (-15 pts each)</li>
                </ul>
                <p className="text-muted-foreground mt-2">
                  Higher effectiveness means more efficient economic policies with fewer
                  contradictions.
                </p>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  Pro Tips
                </h3>
                <ul className="text-muted-foreground space-y-2 text-xs">
                  <li>
                    <strong>Start with Presets:</strong> Use economic archetypes (Capitalist,
                    Socialist, Mixed Economy) as templates, then customize
                  </li>
                  <li>
                    <strong>Balance vs. Specialization:</strong> Diverse sectors create stability,
                    focused sectors create competitive advantages
                  </li>
                  <li>
                    <strong>Watch Conflicts:</strong> Avoid major contradictions between components
                  </li>
                  <li>
                    <strong>Preview Before Saving:</strong> Always review the complete configuration
                    before saving
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
