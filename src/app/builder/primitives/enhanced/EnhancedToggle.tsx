"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useSectionTheme, getGlassClasses } from "./theme-utils";
import { MOTION_VARIANTS } from "./animation-utils";
import type { SectionId } from "./types";

interface EnhancedToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  sectionId?: SectionId;
  theme?: "gold" | "blue" | "emerald" | "purple" | "red" | "default";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  required?: boolean;
  variant?: "switch" | "checkbox" | "button";
  showIcons?: boolean;
  className?: string;
  icon?: React.ComponentType<any>;
}

export function EnhancedToggle({
  checked,
  onChange,
  label,
  description,
  sectionId,
  theme,
  size = "md",
  disabled = false,
  required = false,
  variant = "switch",
  showIcons = true,
  className,
  icon: Icon,
}: EnhancedToggleProps) {
  const [isPressed, setIsPressed] = useState(false);
  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);

  const sizeConfigs = {
    sm: {
      switch: { width: 40, height: 20, thumb: 16 },
      checkbox: { size: 16 },
      button: { padding: "px-3 py-1.5", text: "text-sm" },
      label: "text-sm",
      icon: "h-3 w-3",
    },
    md: {
      switch: { width: 48, height: 24, thumb: 20 },
      checkbox: { size: 20 },
      button: { padding: "px-4 py-2", text: "text-base" },
      label: "text-base",
      icon: "h-4 w-4",
    },
    lg: {
      switch: { width: 56, height: 28, thumb: 24 },
      checkbox: { size: 24 },
      button: { padding: "px-6 py-3", text: "text-lg" },
      label: "text-lg",
      icon: "h-5 w-5",
    },
  };

  const config = sizeConfigs[size];

  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const renderSwitch = () => (
    <div className="flex items-center gap-3">
      <motion.button
        type="button"
        onClick={handleToggle}
        onPointerDown={() => setIsPressed(true)}
        onPointerUp={() => setIsPressed(false)}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className={cn(
          "relative rounded-full transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none",
          getGlassClasses("base", resolvedTheme, sectionId),
          disabled && "cursor-not-allowed opacity-50"
        )}
        style={{
          width: config.switch.width,
          height: config.switch.height,
          backgroundColor: checked ? colors.primary : colors.background,
          borderColor: checked ? colors.primary : colors.border,
        }}
      >
        {/* Switch Thumb */}
        <motion.div
          layout
          className="absolute top-0.5 rounded-full shadow-sm"
          style={{
            width: config.switch.thumb,
            height: config.switch.thumb,
            backgroundColor: checked ? "white" : colors.muted,
            left: checked ? config.switch.width - config.switch.thumb - 2 : 2,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {/* Inner glow */}
          <div
            className="absolute inset-1 rounded-full opacity-60"
            style={{ backgroundColor: checked ? colors.accent : "transparent" }}
          />
        </motion.div>

        {/* Switch Icons */}
        {showIcons && (
          <>
            <Check
              className={cn(
                "absolute top-1/2 left-1 -translate-y-1/2 transform transition-opacity",
                config.icon,
                checked ? "opacity-100" : "opacity-0"
              )}
              color="white"
            />
            <X
              className={cn(
                "absolute top-1/2 right-1 -translate-y-1/2 transform transition-opacity",
                config.icon,
                !checked ? "opacity-100" : "opacity-0"
              )}
              color={colors.muted}
            />
          </>
        )}
      </motion.button>

      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && (
            <label
              className={cn(
                "text-foreground flex cursor-pointer items-center gap-2 font-medium",
                config.label,
                disabled && "cursor-not-allowed"
              )}
            >
              {Icon && <Icon className={config.icon} />}
              {label}
              {required && <span className="text-red-400">*</span>}
            </label>
          )}
          {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
        </div>
      )}
    </div>
  );

  const renderCheckbox = () => (
    <div className="flex items-start gap-3">
      <motion.button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        className={cn(
          "flex items-center justify-center rounded border-2 transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none",
          getGlassClasses("base", resolvedTheme, sectionId),
          disabled && "cursor-not-allowed opacity-50"
        )}
        style={{
          width: config.checkbox.size,
          height: config.checkbox.size,
          backgroundColor: checked ? colors.primary : "transparent",
          borderColor: checked ? colors.primary : colors.border,
        }}
      >
        <motion.div {...MOTION_VARIANTS.scaleIn} animate={{ scale: checked ? 1 : 0 }}>
          <Check className={cn(config.icon)} color="white" />
        </motion.div>
      </motion.button>

      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && (
            <label
              className={cn(
                "text-foreground flex cursor-pointer items-center gap-2 font-medium",
                config.label,
                disabled && "cursor-not-allowed"
              )}
            >
              {Icon && <Icon className={config.icon} />}
              {label}
              {required && <span className="text-red-400">*</span>}
            </label>
          )}
          {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
        </div>
      )}
    </div>
  );

  const renderButton = () => (
    <motion.button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(
        "flex items-center gap-2 rounded-lg font-medium transition-all duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none",
        config.button.padding,
        config.button.text,
        getGlassClasses(checked ? "elevated" : "base", resolvedTheme, sectionId),
        disabled && "cursor-not-allowed opacity-50"
      )}
      style={{
        backgroundColor: checked ? colors.primary : colors.background,
        color: checked ? "white" : colors.text,
        borderColor: checked ? colors.primary : colors.border,
      }}
    >
      {Icon && (
        <motion.div animate={{ rotate: checked ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <Icon className={config.icon} />
        </motion.div>
      )}

      {label || (checked ? "Enabled" : "Disabled")}

      {showIcons && (
        <motion.div animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}>
          <Check className={config.icon} />
        </motion.div>
      )}

      {description && <span className="ml-2 text-xs opacity-75">{description}</span>}
    </motion.button>
  );

  return (
    <div className={cn("", className)} style={cssVars as React.CSSProperties}>
      {variant === "switch" && renderSwitch()}
      {variant === "checkbox" && renderCheckbox()}
      {variant === "button" && renderButton()}
    </div>
  );
}
