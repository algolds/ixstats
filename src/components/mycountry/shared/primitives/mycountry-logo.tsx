"use client";

import React from "react";
import { motion, type Easing } from "motion/react";
import { Crown, Globe } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { BUILDER_VERSION } from "~/lib/buildVersion";
import { Badge } from "~/components/ui/badge";

interface MyCountryLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
  variant?: "full" | "icon-only" | "text-only";
  animated?: boolean;
  className?: string;
  mode?: "create" | "edit";
  showVersion?: boolean;
  showSubtitle?: boolean;
}

const sizeConfig = {
  sm: {
    container: "h-8",
    globe: "h-6 w-6",
    crown: "h-4 w-4",
    text: "text-title-3",
    spacing: "gap-2",
  },
  md: {
    container: "h-10",
    globe: "h-8 w-8",
    crown: "h-5 w-5",
    text: "text-title-2",
    spacing: "gap-3",
  },
  lg: {
    container: "h-12",
    globe: "h-10 w-10",
    crown: "h-6 w-6",
    text: "text-title-1",
    spacing: "gap-3",
  },
  xl: {
    container: "h-16",
    globe: "h-12 w-12",
    crown: "h-8 w-8",
    text: "text-large-title",
    spacing: "gap-4",
  },
  xxl: {
    container: "h-20",
    globe: "h-24 w-24",
    crown: "h-20 w-20",
    text: "text-display",
    spacing: "gap-6",
  },
};

export function MyCountryLogo({
  size = "md",
  variant = "full",
  animated = true,
  className,
  mode = "create",
  showVersion = false,
  showSubtitle = false,
}: MyCountryLogoProps) {
  const config = sizeConfig[size];
  const isEditMode = mode === "edit";

  const iconVariants = {
    initial: { scale: 1, rotate: 0 },
    hover: {
      scale: 1.05,
      rotate: [0, -2, 2, 0],
      transition: {
        duration: 0.6,
        ease: "easeInOut" as Easing,
        rotate: {
          repeat: Infinity,
          duration: 2,
          ease: "easeInOut" as Easing,
        },
      },
    },
  };

  const crownVariants = {
    initial: { y: 0, scale: 1 },
    hover: {
      y: -2,
      scale: 1.1,
      transition: {
        duration: 0.3,
        ease: "easeOut" as Easing,
      },
    },
  };

  const textVariants = {
    initial: { opacity: 1 },
    hover: {
      opacity: 1,
      transition: {
        duration: 0.3,
      },
    },
  };

  // Elements, not inner components: a component defined here would remount (and reset its
  // hover animation) on every render of the logo.
  const logoIcon = (
    <motion.div
      className="relative flex items-center justify-center"
      variants={animated ? iconVariants : {}}
      initial="initial"
      whileHover={animated ? "hover" : undefined}
    >
      {/* Globe background with gold glow */}
      <div
        className={cn(
          "relative rounded-full",
          "bg-gradient-to-br from-amber-200 to-amber-400",
          "shadow-card",
          "border border-amber-300/50",
          config.globe
        )}
      >
        <Globe className={cn("absolute inset-0 m-auto text-amber-900/80", config.globe)} />
      </div>

      {/* Crown overlay */}
      <motion.div className="absolute -top-1 -right-1" variants={animated ? crownVariants : {}}>
        <div
          className={cn(
            "rounded-full border border-amber-300 bg-amber-400",
            "shadow-card",
            "flex items-center justify-center",
            size === "sm" || size === "md" ? "p-1" : size === "lg" ? "p-2" : "p-3"
          )}
        >
          <Crown className={cn("text-amber-900", config.crown)} />
        </div>
      </motion.div>
    </motion.div>
  );

  const logoText = (
    <motion.div variants={animated ? textVariants : {}} className="flex flex-col leading-none">
      <span
        className={cn(
          "bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent",
          config.text
        )}
        style={{ filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))" }}
      >
        MyCountry
      </span>
      {(showSubtitle || showVersion) && (
        <span className="flex items-center gap-2">
          {showSubtitle && (
            <span
              className={cn(
                "text-yellow-ink uppercase",
                size === "xl" ? "text-subhead" : "text-caption"
              )}
              style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))" }}
            >
              {isEditMode ? "EDITOR®" : "BUILDER®"}
            </span>
          )}
          {showVersion && (
            <Badge variant="warning" className="px-1 tabular-nums">
              v{BUILDER_VERSION}
            </Badge>
          )}
        </span>
      )}
    </motion.div>
  );

  if (variant === "icon-only") {
    return <div className={cn(config.container, "flex items-center", className)}>{logoIcon}</div>;
  }

  if (variant === "text-only") {
    return <div className={cn(config.container, "flex items-center", className)}>{logoText}</div>;
  }

  return (
    <motion.div
      className={cn(config.container, "flex items-center", config.spacing, className)}
      initial="initial"
      whileHover={animated ? "hover" : undefined}
    >
      {logoIcon}
      {logoText}
    </motion.div>
  );
}
