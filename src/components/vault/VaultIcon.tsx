"use client";

import React from "react";
import { motion, type Easing } from "motion/react";
import { Vault, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";

interface VaultIconProps {
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
  variant?: "full" | "icon-only" | "text-only";
  animated?: boolean;
  className?: string;
  showLevel?: boolean;
  level?: number;
}

const sizeConfig = {
  sm: {
    container: "h-8",
    vault: "h-6 w-6",
    sparkle: "h-3 w-3",
    text: "text-lg",
    spacing: "gap-2",
  },
  md: {
    container: "h-10",
    vault: "h-8 w-8",
    sparkle: "h-4 w-4",
    text: "text-xl",
    spacing: "gap-3",
  },
  lg: {
    container: "h-12",
    vault: "h-10 w-10",
    sparkle: "h-5 w-5",
    text: "text-2xl",
    spacing: "gap-3",
  },
  xl: {
    container: "h-16",
    vault: "h-12 w-12",
    sparkle: "h-6 w-6",
    text: "text-3xl",
    spacing: "gap-4",
  },
  xxl: {
    container: "h-20",
    vault: "h-16 w-16",
    sparkle: "h-8 w-8",
    text: "text-4xl",
    spacing: "gap-6",
  },
};

export function VaultIcon({
  size = "md",
  variant = "full",
  animated = true,
  className,
  showLevel = false,
  level = 1,
}: VaultIconProps) {
  const config = sizeConfig[size];

  const iconVariants = {
    initial: { scale: 1, rotate: 0 },
    hover: {
      scale: 1.05,
      rotate: [0, -3, 3, 0],
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

  const sparkleVariants = {
    initial: { scale: 1, opacity: 0.8 },
    hover: {
      scale: [1, 1.2, 1],
      opacity: [0.8, 1, 0.8],
      transition: {
        duration: 1.5,
        ease: "easeInOut" as Easing,
        repeat: Infinity,
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

  const VaultIconGraphic = () => (
    <motion.div
      className="relative flex items-center justify-center"
      variants={animated ? iconVariants : {}}
      initial="initial"
      whileHover={animated ? "hover" : undefined}
    >
      {/* Vault background with gold/purple gradient */}
      <div
        className={cn(
          "relative rounded-xl",
          "bg-gradient-to-br from-purple-500 via-purple-600 to-gold-500",
          "shadow-lg shadow-purple-500/40",
          "border border-purple-400/50",
          "p-2",
          config.vault
        )}
      >
        <Vault className={cn("absolute inset-0 m-auto text-white/90", config.vault)} />

        {/* Holographic glow overlay */}
        <div
          className={cn(
            "absolute inset-0 rounded-xl",
            "bg-gradient-to-tr from-transparent via-white/30 to-transparent",
            "opacity-60"
          )}
        />

        {/* Shimmer effect */}
        {animated && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{
              x: ["-100%", "200%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
      </div>

      {/* Sparkle overlay */}
      <motion.div
        className="absolute -top-1 -right-1"
        variants={animated ? sparkleVariants : {}}
      >
        <div
          className={cn(
            "rounded-full border border-gold-300 bg-gold-400",
            "shadow-lg shadow-gold-500/50",
            "flex items-center justify-center",
            size === "sm" ? "p-1" : size === "md" ? "p-1.5" : size === "lg" ? "p-2" : "p-2.5"
          )}
        >
          <Sparkles className={cn("text-purple-900", config.sparkle)} />
        </div>
      </motion.div>

      {/* Level badge (if enabled) */}
      {showLevel && (
        <motion.div
          className={cn(
            "absolute -bottom-1 -right-1",
            "bg-gradient-to-br from-gold-400 to-orange-500",
            "border-2 border-gold-300",
            "rounded-full shadow-lg shadow-gold-500/50",
            "flex items-center justify-center",
            "text-xs font-black text-black",
            size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : "h-6 w-6"
          )}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          {level}
        </motion.div>
      )}
    </motion.div>
  );

  const VaultText = () => (
    <motion.div variants={animated ? textVariants : {}} className="flex flex-col leading-none">
      <span
        className={cn(
          "bg-gradient-to-r from-purple-400 via-purple-500 to-gold-400 bg-clip-text font-bold text-transparent",
          config.text
        )}
      >
        MyVault
      </span>
      <span
        className={cn(
          "text-xs font-medium tracking-wider text-purple-400/80",
          size === "xl" ? "text-sm" : "text-xs"
        )}
      >
        COLLECTION®
      </span>
    </motion.div>
  );

  if (variant === "icon-only") {
    return (
      <div className={cn(config.container, "flex items-center", className)}>
        <VaultIconGraphic />
      </div>
    );
  }

  if (variant === "text-only") {
    return (
      <div className={cn(config.container, "flex items-center", className)}>
        <VaultText />
      </div>
    );
  }

  return (
    <motion.div
      className={cn(config.container, "flex items-center", config.spacing, className)}
      initial="initial"
      whileHover={animated ? "hover" : undefined}
    >
      <VaultIconGraphic />
      <VaultText />
    </motion.div>
  );
}

// Simplified versions
export function VaultIconOnly({
  size = "md",
  className,
  animated = false,
  showLevel,
  level,
}: Omit<VaultIconProps, "variant">) {
  return (
    <VaultIcon
      size={size}
      variant="icon-only"
      animated={animated}
      className={className}
      showLevel={showLevel}
      level={level}
    />
  );
}
