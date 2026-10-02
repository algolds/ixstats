"use client";

import React from "react";
import { motion } from "motion/react";
import { Badge } from "~/components/ui/badge";
import {
  CheckCircle,
  WarningCircle as AlertCircle,
  StatUp as TrendingUp,
  Clock,
  Group as Users,
  Flash as Zap,
  InfoCircle as Info,
} from "iconoir-react";
import { cn } from "~/lib/utils/cn";
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
      return `border-2 border-${themeClasses.selectedBorder} bg-${themeClasses.selectedBg} ${themeClasses.selectedBgDark} shadow-floating`;
    }
    if (hasConflict && !isSelected) {
      return `border-2 border-${themeClasses.conflictBorder} bg-${themeClasses.conflictBg} ${themeClasses.conflictBgDark} opacity-60`;
    }
    if (hasSynergy && !isSelected) {
      return `border-2 border-${themeClasses.synergyBorder} bg-${themeClasses.synergyBg} ${themeClasses.synergyBgDark}`;
    }
    if (isDisabled) {
      return "border-2 border-separator opacity-50 cursor-not-allowed";
    }
    return `border-2 border-separator hover:border-${themeClasses.primaryLight}/50 hover:shadow-card`;
  };

  const getIconColor = () => {
    if (isSelected) {
      return `text-${themeClasses.primary}`;
    }
    return "text-label-secondary";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: isDisabled ? 1 : 1.02 }}
      whileTap={{ scale: isDisabled ? 1 : 0.98 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-control cursor-pointer p-2 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
        getCardClasses(),
        className
      )}
      onClick={isDisabled ? undefined : onToggle}
    >
      {/* Header */}
      <div className="mb-1 flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className={cn(
              "rounded-control-sm shrink-0 p-1",
              isSelected
                ? `${getEffectivenessBgColor(component.effectiveness)} ${getIconColor()}`
                : "bg-fill-3"
            )}
          >
            {component.icon && typeof component.icon === "function" ? (
              React.createElement(component.icon, { className: "h-3 w-3" })
            ) : (
              <Info className="h-3 w-3" />
            )}
          </div>
          <h4 className="text-label text-caption truncate leading-tight font-semibold">
            {component.name}
          </h4>
        </div>

        <div className="ml-1 flex shrink-0 items-center gap-0.5">
          <Badge variant="outline" className="text-footnote h-4 px-1 leading-none">
            {component.effectiveness}%
          </Badge>
          {isSelected && <CheckCircle className="text-green h-3 w-3" />}
          {hasConflict && !isSelected && <AlertCircle className="text-red h-3 w-3" />}
          {hasSynergy && !isSelected && <TrendingUp className="text-green h-3 w-3" />}
        </div>
      </div>

      {/* Description */}
      <p className="text-label-secondary text-footnote mb-1 line-clamp-2 leading-snug">
        {component.description}
      </p>

      {/* Metadata */}
      <div className="space-y-0.5">
        <div className="text-footnote flex items-center justify-between">
          <span className="text-label-secondary">Impl:</span>
          <span className="font-medium">${(component.implementationCost / 1000).toFixed(0)}k</span>
        </div>
        <div className="text-footnote flex items-center justify-between">
          <span className="text-label-secondary">Annual:</span>
          <span className="font-medium">${(component.maintenanceCost / 1000).toFixed(0)}k</span>
        </div>
        <div className="text-footnote flex items-center justify-between">
          <span className="text-label-secondary">Complexity:</span>
          <Badge
            variant="default"
            className={cn(
              "text-footnote h-3.5 px-1 leading-none",
              getComplexityBgColor(component.metadata.complexity),
              getComplexityColor(component.metadata.complexity)
            )}
          >
            {component.metadata.complexity}
          </Badge>
        </div>
      </div>

      {/* Additional Metadata */}
      <div className="border-separator mt-1 flex items-center gap-2 border-t pt-1">
        <span className="text-label-secondary text-footnote flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {component.metadata.timeToImplement}
        </span>
        <span className="text-label-secondary text-footnote flex items-center gap-0.5">
          <Users className="h-2.5 w-2.5" />
          {component.metadata.staffRequired}
        </span>
        {component.metadata.technologyRequired && (
          <span className="text-footnote text-blue flex items-center gap-0.5">
            <Zap className="h-2.5 w-2.5" />
            Tech
          </span>
        )}
      </div>

      {/* Prerequisites */}
      {component.prerequisites.length > 0 && (
        <div className="border-separator mt-1 border-t pt-1">
          <p className="text-label-secondary text-footnote truncate">
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
