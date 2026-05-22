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
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SectionHeaderBackground } from "~/components/mycountry/primitives/SectionHeaderBackground";
import { motion } from "motion/react";
import { BUILDER_SECTION_THEMES, HEADER_NAV_STEPS, type BuilderSection } from "../lib/builder-theme";
import { AutosaveHistoryPanel } from "~/components/builder/AutosaveHistoryPanel";
import { BuilderContextualHelp } from "./BuilderContextualHelp";
import { BuilderStepNav } from "./BuilderStepNav";
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
  /** Step navigation: callback when user clicks a step */
  onNavigate?: (section: BuilderSection) => void;
  /** Set of completed BuilderSection names */
  completedSteps?: Set<BuilderSection>;
  /** Set of accessible/unlocked BuilderSection names */
  accessibleSteps?: Set<BuilderSection>;
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
  onNavigate,
  completedSteps,
  accessibleSteps,
}: BuilderSectionHeroProps) {
  const theme = BUILDER_SECTION_THEMES[section];
  const Icon = SECTION_ICONS[section];
  const isEditMode = mode === "edit";
  const [showHistory, setShowHistory] = useState(false);
  const showStepNav = onNavigate !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <SectionHeaderBackground context="hero">
        <div className={`glass-hierarchy-parent rounded-xl border ${theme.border} p-3 sm:p-4 transition-all duration-300`}>

          {/* Inline Step Navigation */}
          {showStepNav && onNavigate && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-1 -m-1">
              <div className="flex-1 min-w-0">
                <BuilderStepNav
                  activeSection={section}
                  onNavigate={onNavigate}
                  completedSteps={completedSteps}
                  accessibleSteps={accessibleSteps}
                />
              </div>

              {/* Actions moved to nav bar */}
              <div className="flex items-center gap-1 flex-shrink-0 bg-card/40 backdrop-blur-lg border border-border/60 rounded-xl px-2 h-[42px]">
                {/* Autosave indicator */}
                {lastSaved && (
                  <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground mr-2 border-r border-border/60 pr-3">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isAutoSaving ? "animate-pulse bg-amber-500" : "bg-green-500"
                      )}
                    />
                    <span className="whitespace-nowrap">
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
                    className="h-8 gap-1.5 text-xs hover:bg-muted/60"
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
                    className="h-8 gap-1.5 text-xs hover:bg-muted/60"
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
                      "h-8 gap-1.5 text-xs hover:bg-muted/60",
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
                    className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                )}
              </div>

              {/* Contextual Help */}
              <BuilderContextualHelp activeSection={section} />
            </div>
          )}
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
