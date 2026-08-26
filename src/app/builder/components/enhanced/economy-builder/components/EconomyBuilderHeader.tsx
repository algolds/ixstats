"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
// oxlint-disable-next-line eslint/no-unused-vars
import { HelpCircle, WarningTriangle as AlertTriangle, InfoCircle as Info, SystemRestart as Loader2, Atom, Group as Users, Dollar as DollarSign } from "iconoir-react";

interface EconomyBuilderHeaderProps {
  isLoadingConfig: boolean;
  // Save/autosave status is centralized in the builder Dynamic Island
  // (BuilderDIPlugin) + the global updateCountry autosave. No per-component
  // autosave indicators here.
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
