"use client";

import React from "react";
import { motion } from "framer-motion";
import { Badge } from "~/components/ui/badge";
import {
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Users,
  Zap,
  Shield,
  Info,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { UnifiedAtomicCardProps } from "./types";
import {
  getThemeColorClasses,
  getComplexityColor,
  getComplexityBgColor,
  getEffectivenessColor,
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
      return `border-2 ${themeClasses.selectedBorder} ${themeClasses.selectedBg} dark:${themeClasses.selectedBgDark} shadow-lg`;
    }
    if (hasConflict && !isSelected) {
      return `border-2 ${themeClasses.conflictBorder} ${themeClasses.conflictBg} dark:${themeClasses.conflictBgDark} opacity-60`;
    }
    if (hasSynergy && !isSelected) {
      return `border-2 ${themeClasses.synergyBorder} ${themeClasses.synergyBg} dark:${themeClasses.synergyBgDark}`;
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
      className={cn("cursor-pointer rounded-lg p-4 transition-all", getCardClasses(), className)}
      onClick={isDisabled ? undefined : onToggle}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "rounded-lg p-2",
              isSelected
                ? `${getEffectivenessBgColor(component.effectiveness)} ${getIconColor()}`
                : "bg-muted"
            )}
          >
            {component.icon && typeof component.icon === "function" ? (
              React.createElement(component.icon, { className: "h-4 w-4" })
            ) : (
              <Info className="h-4 w-4" />
            )}
          </div>
          <h4 className="text-foreground text-sm font-semibold">{component.name}</h4>
        </div>

        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs">
            {component.effectiveness}%
          </Badge>
          {isSelected && <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
          {hasConflict && !isSelected && (
            <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
          )}
          {hasSynergy && !isSelected && (
            <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-3 line-clamp-2 text-xs">{component.description}</p>

      {/* Metadata Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Implementation:</span>
          <span className="font-medium">${(component.implementationCost / 1000).toFixed(0)}k</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Annual:</span>
          <span className="font-medium">${(component.maintenanceCost / 1000).toFixed(0)}k</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Complexity:</span>
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              getComplexityBgColor(component.metadata.complexity),
              getComplexityColor(component.metadata.complexity)
            )}
          >
            {component.metadata.complexity}
          </Badge>
        </div>
      </div>

      {/* Additional Metadata */}
      <div className="border-border/50 mt-2 space-y-1 border-t pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Time:
          </span>
          <span className="font-medium">{component.metadata.timeToImplement}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            Staff:
          </span>
          <span className="font-medium">{component.metadata.staffRequired}</span>
        </div>
        {component.metadata.technologyRequired && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Tech:
            </span>
            <span className="font-medium text-blue-600 dark:text-blue-400">Required</span>
          </div>
        )}
      </div>

      {/* Prerequisites */}
      {component.prerequisites.length > 0 && (
        <div className="border-border/50 mt-2 border-t pt-2">
          <p className="text-muted-foreground text-xs">
            <span className="font-medium">Requires:</span> {component.prerequisites.join(", ")}
          </p>
        </div>
      )}
    </motion.div>
  );
};
