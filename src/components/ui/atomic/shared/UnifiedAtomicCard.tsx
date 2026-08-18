"use client";

import React from "react";
import { motion } from "motion/react";
import { Badge } from "~/components/ui/badge";
import { CheckCircle, AlertCircle, TrendingUp, Clock, Users, Zap, Info } from "lucide-react";
import { cn } from "~/lib/utils";
import type { UnifiedAtomicCardProps } from "./types";
import {
  getThemeColorClasses,
  getComplexityColor,
  getComplexityBgColor,
  getEffectivenessBgColor,
} from "./themes";

export const UnifiedAtomicCard: React.FC<UnifiedAtomicCardProps> = ({
  component,
  isSelected,
  onToggle,
  isDisabled = false,
  hasConflict = false,
  hasSynergy = false,
  theme,
  className,
}) => {
  const themeClasses = getThemeColorClasses(theme, component.category);

  const getCardClasses = () => {
    if (isSelected) {
      return `border-2 border-${themeClasses.selectedBorder} bg-${themeClasses.selectedBg} dark:bg-${themeClasses.selectedBgDark} shadow-lg`;
    }
    if (hasConflict && !isSelected) {
      return `border-2 border-${themeClasses.conflictBorder} bg-${themeClasses.conflictBg} dark:bg-${themeClasses.conflictBgDark} opacity-60`;
    }
    if (hasSynergy && !isSelected) {
      return `border-2 border-${themeClasses.synergyBorder} bg-${themeClasses.synergyBg} dark:bg-${themeClasses.synergyBgDark}`;
    }
    if (isDisabled) {
      return "border-2 border-border opacity-50 cursor-not-allowed";
    }
    return `border-2 border-border hover:border-${themeClasses.primaryLight}/50 hover:shadow-md`;
  };

  const getIconColor = () => {
    if (isSelected) {
      return `text-${themeClasses.primary}`;
    }
    return "text-muted-foreground";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: isDisabled ? 1 : 1.02 }}
      whileTap={{ scale: isDisabled ? 1 : 0.98 }}
      transition={{ duration: 0.2 }}
      className={cn("cursor-pointer rounded-lg p-2 transition-all", getCardClasses(), className)}
      onClick={isDisabled ? undefined : onToggle}
    >
      {/* Header */}
      <div className="mb-1 flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <div
            className={cn(
              "shrink-0 rounded-md p-1",
              isSelected
                ? `${getEffectivenessBgColor(component.effectiveness)} ${getIconColor()}`
                : "bg-muted"
            )}
          >
            {component.icon && typeof component.icon === "function" ? (
              React.createElement(component.icon, { className: "h-3 w-3" })
            ) : (
              <Info className="h-3 w-3" />
            )}
          </div>
          <h4 className="text-foreground truncate text-xs leading-tight font-semibold">
            {component.name}
          </h4>
        </div>

        <div className="ml-1 flex shrink-0 items-center gap-0.5">
          <Badge variant="outline" className="h-4 px-1 text-[9px] leading-none">
            {component.effectiveness}%
          </Badge>
          {isSelected && <CheckCircle className="h-3 w-3 text-green-500 dark:text-green-400" />}
          {hasConflict && !isSelected && (
            <AlertCircle className="h-3 w-3 text-red-500 dark:text-red-400" />
          )}
          {hasSynergy && !isSelected && (
            <TrendingUp className="h-3 w-3 text-green-500 dark:text-green-400" />
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-1 line-clamp-2 text-[10px] leading-snug">
        {component.description}
      </p>

      {/* Metadata */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Impl:</span>
          <span className="font-medium">${(component.implementationCost / 1000).toFixed(0)}k</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Annual:</span>
          <span className="font-medium">${(component.maintenanceCost / 1000).toFixed(0)}k</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Complexity:</span>
          <Badge
            variant="secondary"
            className={cn(
              "h-3.5 px-1 text-[9px] leading-none",
              getComplexityBgColor(component.metadata.complexity),
              getComplexityColor(component.metadata.complexity)
            )}
          >
            {component.metadata.complexity}
          </Badge>
        </div>
      </div>

      {/* Additional Metadata */}
      <div className="border-border/50 mt-1 flex items-center gap-2 border-t pt-1">
        <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
          <Clock className="h-2.5 w-2.5" />
          {component.metadata.timeToImplement}
        </span>
        <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
          <Users className="h-2.5 w-2.5" />
          {component.metadata.staffRequired}
        </span>
        {component.metadata.technologyRequired && (
          <span className="flex items-center gap-0.5 text-[10px] text-blue-500 dark:text-blue-400">
            <Zap className="h-2.5 w-2.5" />
            Tech
          </span>
        )}
      </div>

      {/* Prerequisites */}
      {component.prerequisites.length > 0 && (
        <div className="border-border/50 mt-1 border-t pt-1">
          <p className="text-muted-foreground truncate text-[10px]">
            <span className="font-medium">Requires:</span>{" "}
            {component.prerequisites
              .map((p) =>
                p
                  .split("_")
                  .map((word) => {
                    if (word.toLowerCase() === "rd" || word.toLowerCase() === "r&d") return "R&D";
                    if (word.toLowerCase() === "vat") return "VAT";
                    return word.charAt(0).toUpperCase() + word.slice(1);
                  })
                  .join(" ")
              )
              .join(", ")}
          </p>
        </div>
      )}
    </motion.div>
  );
};
