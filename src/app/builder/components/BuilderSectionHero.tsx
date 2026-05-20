"use client";

import React, { useState } from "react";
import {
  Globe,
  Flag,
  Building2,
  TrendingUp,
  CheckCircle,
  Download,
  Save,
  Loader2,
  History,
  Settings,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SectionHeaderBackground } from "~/components/mycountry/primitives/SectionHeaderBackground";
import { motion } from "motion/react";
import { BUILDER_SECTION_THEMES, type BuilderSection, BUILD_STEPS } from "../lib/builder-theme";
import { AutosaveHistoryPanel } from "~/components/builder/AutosaveHistoryPanel";
import { BuilderContextualHelp } from "./BuilderContextualHelp";
import { cn } from "~/lib/utils";

interface BuilderSectionHeroProps {
  section: BuilderSection;
  /** Country name once the user has named it */
  countryName?: string;
  /** Overall completion percentage */
  completionPercent?: number;
  /** Completed step count */
  completedCount?: number;
  /** Last saved timestamp */
  lastSaved?: Date | null;
  /** Is currently auto-saving */
  isAutoSaving?: boolean;
  /** Manual save handler */
  onManualSave?: () => Promise<void>;
  /** Is manual save in progress */
  isSaving?: boolean;
  /** Clear draft handler */
  onClearDraft?: () => void;
  /** Toggle advanced mode */
  onToggleAdvanced?: () => void;
  /** Is advanced mode enabled */
  isAdvancedMode?: boolean;
  /** Builder mode */
  mode?: "create" | "edit";
  /** Country ID for edit mode */
  countryId?: string;
}

const SECTION_ICONS: Record<BuilderSection, LucideIcon> = {
  foundation: Globe,
  identity: Flag,
  government: Building2,
  economics: TrendingUp,
  preview: CheckCircle,
  import: Download,
};

export const BuilderSectionHero = React.memo(function BuilderSectionHero({
  section,
  countryName,
  completionPercent,
  completedCount,
  lastSaved,
  isAutoSaving,
  onManualSave,
  isSaving,
  onClearDraft,
  onToggleAdvanced,
  isAdvancedMode,
  mode = "create",
  countryId,
}: BuilderSectionHeroProps) {
  const theme = BUILDER_SECTION_THEMES[section];
  const Icon = SECTION_ICONS[section];
  const stepIdx = BUILD_STEPS.indexOf(section);
  const isStep = stepIdx >= 0;
  const isEditMode = mode === "edit";
  const [showHistory, setShowHistory] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <SectionHeaderBackground context="hero">
        <div className={`glass-hierarchy-parent rounded-xl border ${theme.border} p-3 sm:p-4`}>
          {/* Top row: Breadcrumb + Actions */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                MyCountry Builder
              </Badge>
              <span className="text-muted-foreground text-sm">&rarr;</span>
              <Badge className={`bg-gradient-to-r ${theme.gradient} text-white`}>
                <Icon size={12} className="mr-1" />
                {theme.flavorTitle}
              </Badge>
              {isStep && (
                <span className="text-muted-foreground text-xs hidden sm:inline">
                  Step {stepIdx + 1} of {BUILD_STEPS.length}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Autosave indicator */}
              {lastSaved && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      isAutoSaving ? "animate-pulse bg-amber-500" : "bg-green-500"
                    )}
                  />
                  <span>
                    {isAutoSaving ? "Saving..." : `Saved ${lastSaved.toLocaleTimeString()}`}
                  </span>
                </div>
              )}

              {/* Manual save */}
              {onManualSave && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onManualSave}
                  disabled={isSaving}
                  className="h-8 gap-1.5 text-xs"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">Save</span>
                </Button>
              )}

              {/* History (edit mode) */}
              {isEditMode && countryId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(true)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <History className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">History</span>
                </Button>
              )}

              {/* Advanced mode toggle */}
              {onToggleAdvanced && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleAdvanced}
                  className={cn(
                    "h-8 gap-1.5 text-xs",
                    isAdvancedMode && "bg-muted"
                  )}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {isAdvancedMode ? "Basic" : "Advanced"}
                  </span>
                </Button>
              )}

              {/* Clear draft */}
              {onClearDraft && !isEditMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearDraft}
                  className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}

              {/* Contextual Help */}
              <BuilderContextualHelp activeSection={section} />
            </div>
          </div>

          {/* Main content row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`rounded-full bg-gradient-to-r ${theme.gradient} p-2 flex-shrink-0`}>
                <Icon size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">
                  {countryName || theme.flavorTitle}
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {theme.flavorSubtitle}
                </p>
              </div>
            </div>

            {/* Progress indicator (desktop only) */}
            {completionPercent !== undefined && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${theme.gradient} transition-all duration-500`}
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {completionPercent}%
                  </span>
                </div>
                {completedCount !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {completedCount}/{BUILD_STEPS.length} steps
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </SectionHeaderBackground>

      {/* Autosave History Panel */}
      {isEditMode && countryId && (
        <AutosaveHistoryPanel
          countryId={countryId}
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </motion.div>
  );
});
