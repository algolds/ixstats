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
  onHelpClick?: () => void;
  selectedArchetypeName?: string | null;
}

export function EconomyBuilderHeader({
  isLoadingConfig,
  isAutoSaveEnabled,
  hasUnsavedChanges,
  lastSaved,
  showSuccessAnimation,
  validationStatus,
  onHelpClick,
  selectedArchetypeName,
}: EconomyBuilderHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-foreground flex items-center gap-2 text-3xl font-bold">
          Economy Builder
          {selectedArchetypeName && (
            <Badge
              variant="secondary"
              className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-500"
            >
              {selectedArchetypeName}
            </Badge>
          )}
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your nation's economy and tax system, and fiscal policies
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
              {!validationStatus.isValid && (
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
        <Button variant="outline" size="sm" className="gap-2" onClick={onHelpClick}>
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
      </div>
    </div>
  );
}
