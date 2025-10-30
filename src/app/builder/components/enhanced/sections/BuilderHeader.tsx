"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Settings, AlertTriangle, Zap } from "lucide-react";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useBuilderContext } from "../context/BuilderStateContext";

interface BuilderHeaderProps {
  onBackToIntro?: () => void;
  onClearDraft?: () => void;
  mode?: "create" | "edit";
}

/**
 * BuilderHeader - Top header section of the builder
 *
 * Displays:
 * - MyCountry logo
 * - Mode badge (Builder/Editor)
 * - Auto-save indicator
 * - Clear draft button
 * - Advanced mode toggle
 * - Back button
 */
export function BuilderHeader({
  onBackToIntro,
  onClearDraft,
  mode = "create",
}: BuilderHeaderProps) {
  const { builderState, setBuilderState, lastSaved, isAutoSaving } = useBuilderContext();
  const isEditMode = mode === "edit";

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur-xl"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.02 }}>
              <MyCountryLogo size="lg" animated mode={mode} />
            </motion.div>
            <Badge
              variant="outline"
              className="hidden items-center gap-1 border-amber-500/20 md:flex"
            >
              <Zap className="h-3 w-3 text-amber-500" />
              {isEditMode ? "Editor" : "Builder"} v1.1
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {/* Autosave indicator */}
            {lastSaved && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <div
                  className={`h-2 w-2 rounded-full ${
                    isAutoSaving ? "animate-pulse bg-amber-500" : "bg-green-500"
                  }`}
                />
                <span className="hidden sm:inline">
                  {isAutoSaving ? "Saving..." : `Saved ${lastSaved.toLocaleTimeString()}`}
                </span>
              </div>
            )}

            {/* Clear draft button - only show if there's saved data */}
            {lastSaved && onClearDraft && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearDraft}
                className="text-muted-foreground hover:text-destructive hidden md:flex"
              >
                <AlertTriangle className="mr-1 h-4 w-4" />
                Clear Draft
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setBuilderState((prev) => ({
                  ...prev,
                  showAdvancedMode: !prev.showAdvancedMode,
                }))
              }
              className="hidden md:flex"
            >
              <Settings className="mr-2 h-4 w-4" />
              {builderState.showAdvancedMode ? "Advanced" : "Basic"} Mode
            </Button>
            {onBackToIntro && (
              <Button variant="outline" onClick={onBackToIntro} size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
