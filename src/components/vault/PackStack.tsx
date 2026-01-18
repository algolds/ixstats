"use client";

import React from "react";
import { motion, AnimatePresence, type Easing } from "framer-motion";
import { Package, PackageOpen } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * Props for the PackStack component
 */
interface PackStackProps {
  /** Type of pack being displayed */
  packType: "basic" | "premium" | "elite" | "mystery";
  /** Number of packs in the stack */
  quantity: number;
  /** Optional custom pack image URL */
  packImage?: string;
  /** Callback when user clicks to open a single pack */
  onOpen?: () => void;
  /** Callback when user clicks to open all packs */
  onOpenAll?: () => void;
  /** Size variant of the pack stack */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Styling configuration for each pack type
 */
const packStyles = {
  basic: {
    border: "border-gray-400",
    glow: "vault-glow-cyan",
    bg: "from-gray-600 to-gray-800",
    badge: "from-gray-500 to-gray-700",
    text: "text-gray-300",
  },
  premium: {
    border: "border-purple-400",
    glow: "vault-glow-purple",
    bg: "from-purple-600 to-purple-800",
    badge: "from-purple-500 to-purple-700",
    text: "text-purple-300",
  },
  elite: {
    border: "border-gold-400",
    glow: "vault-glow-gold",
    bg: "from-gold-600 to-orange-800",
    badge: "from-gold-500 to-orange-700",
    text: "text-gold-300",
  },
  mystery: {
    border: "border-white/40",
    glow: "vault-glow-holographic",
    bg: "vault-gradient-holographic",
    badge: "vault-gradient-holographic",
    text: "text-white",
  },
} as const;

/**
 * Size configuration for the pack stack
 */
const sizeConfig = {
  sm: {
    width: "w-[120px]",
    height: "h-[160px]",
    icon: "h-12 w-12",
    badge: "text-xs px-2 py-0.5",
    button: "text-xs px-2 py-1",
    offset: 3,
  },
  md: {
    width: "w-[160px]",
    height: "h-[220px]",
    icon: "h-16 w-16",
    badge: "text-sm px-3 py-1",
    button: "text-sm px-3 py-1.5",
    offset: 4,
  },
  lg: {
    width: "w-[200px]",
    height: "h-[280px]",
    icon: "h-20 w-20",
    badge: "text-base px-4 py-1.5",
    button: "text-base px-4 py-2",
    offset: 5,
  },
} as const;

/**
 * PackStack Component
 *
 * Displays a visual stack of card packs with interactive hover effects,
 * quantity badge, and action buttons for opening packs.
 *
 * @example
 * ```tsx
 * <PackStack
 *   packType="premium"
 *   quantity={12}
 *   size="md"
 *   onOpen={() => openSinglePack()}
 *   onOpenAll={() => openAllPacks()}
 * />
 * ```
 */
export function PackStack({
  packType,
  quantity,
  packImage,
  onOpen,
  onOpenAll,
  size = "md",
  className,
}: PackStackProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const config = sizeConfig[size];
  const styles = packStyles[packType];

  // Calculate number of visible pack cards (max 5)
  const visiblePacks = Math.min(quantity, 5);

  return (
    <motion.div
      className={cn("relative inline-block", className)}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      initial="initial"
      animate={isHovered ? "hover" : "initial"}
    >
      {/* Stack of pack cards */}
      <div className={cn("relative", config.width, config.height)}>
        {Array.from({ length: visiblePacks }).map((_, index) => {
          const isTopCard = index === visiblePacks - 1;
          const offset = config.offset;
          const rotation = (Math.random() - 0.5) * 4; // ±2 degrees

          return (
            <motion.div
              key={index}
              className={cn(
                "absolute inset-0 rounded-lg border-2",
                "glass-hierarchy-child",
                styles.border,
                styles.glow,
                "overflow-hidden"
              )}
              style={{
                zIndex: index,
                transform: `translate(${index * offset}px, ${index * offset}px) rotate(${rotation}deg)`,
              }}
              variants={{
                initial: {
                  x: index * offset,
                  y: index * offset,
                  rotate: rotation,
                  scale: 1,
                },
                hover: {
                  x: index * offset * 1.5,
                  y: index * offset * 1.5,
                  rotate: rotation * 1.5,
                  scale: isTopCard ? 1.05 : 1,
                  transition: {
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  },
                },
              }}
            >
              {/* Pack background gradient */}
              <div
                className={cn(
                  "absolute inset-0",
                  styles.bg.startsWith("vault-gradient-")
                    ? `bg-[var(--${styles.bg})]`
                    : `bg-gradient-to-br ${styles.bg}`
                )}
              />

              {/* Pack image or default icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                {packImage ? (
                  <img
                    src={packImage}
                    alt={`${packType} pack`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package className={cn(config.icon, "text-white/80")} />
                )}
              </div>

              {/* Holographic overlay effect */}
              {packType === "mystery" && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent"
                  animate={{
                    x: ["-100%", "200%"],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                    delay: index * 0.2,
                  }}
                />
              )}

              {/* Shine effect on hover */}
              {isTopCard && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/20 to-white/0"
                  variants={{
                    initial: { opacity: 0 },
                    hover: { opacity: 1 },
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Quantity badge */}
      <motion.div
        className={cn(
          "absolute -top-2 -right-2 z-50",
          "rounded-full border-2 border-white/40",
          "shadow-lg shadow-black/40",
          "font-bold",
          styles.text,
          config.badge,
          styles.badge.startsWith("vault-gradient-")
            ? `bg-[var(--${styles.badge})]`
            : `bg-gradient-to-br ${styles.badge}`
        )}
        animate={{
          y: [0, -4, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut" as Easing,
        }}
      >
        x{quantity}
      </motion.div>

      {/* Action buttons (shown on hover) */}
      <AnimatePresence>
        {isHovered && (onOpen || onOpenAll) && (
          <motion.div
            className={cn(
              "absolute bottom-0 left-0 right-0 z-50",
              "flex flex-col gap-2 p-2"
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Open 1 button */}
            {onOpen && (
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                className={cn(
                  "flex items-center justify-center gap-2",
                  "rounded-lg border-2 border-white/40",
                  "bg-gradient-to-br from-white/20 to-white/10",
                  "backdrop-blur-md",
                  "font-bold text-white",
                  "shadow-lg shadow-black/40",
                  "transition-all duration-200",
                  "hover:scale-105 hover:from-white/30 hover:to-white/20",
                  "active:scale-95",
                  config.button
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PackageOpen className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
                Open 1
              </motion.button>
            )}

            {/* Open All button */}
            {onOpenAll && quantity > 1 && (
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAll();
                }}
                className={cn(
                  "flex items-center justify-center gap-2",
                  "rounded-lg border border-white/30",
                  "bg-gradient-to-br from-white/10 to-white/5",
                  "backdrop-blur-md",
                  "font-semibold text-white/90",
                  "shadow-md shadow-black/20",
                  "transition-all duration-200",
                  "hover:scale-105 hover:from-white/20 hover:to-white/10",
                  "active:scale-95",
                  config.button
                )}
                style={{ fontSize: size === "sm" ? "0.65rem" : undefined }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PackageOpen className={size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
                Open All ({quantity})
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * PackStackCompact Component
 *
 * A minimal variant of PackStack that shows only a single card
 * with quantity badge, without hover effects or action buttons.
 * Useful for compact displays like inventory lists or mobile views.
 *
 * @example
 * ```tsx
 * <PackStackCompact
 *   packType="elite"
 *   quantity={5}
 *   size="sm"
 * />
 * ```
 */
export function PackStackCompact({
  packType,
  quantity,
  packImage,
  size = "sm",
  className,
}: Omit<PackStackProps, "onOpen" | "onOpenAll">) {
  const config = sizeConfig[size];
  const styles = packStyles[packType];

  return (
    <div className={cn("relative inline-block", className)}>
      {/* Single pack card */}
      <div
        className={cn(
          "relative rounded-lg border-2",
          "glass-hierarchy-child",
          styles.border,
          styles.glow,
          "overflow-hidden",
          config.width,
          config.height
        )}
      >
        {/* Pack background gradient */}
        <div
          className={cn(
            "absolute inset-0",
            styles.bg.startsWith("vault-gradient-")
              ? `bg-[var(--${styles.bg})]`
              : `bg-gradient-to-br ${styles.bg}`
          )}
        />

        {/* Pack image or default icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {packImage ? (
            <img
              src={packImage}
              alt={`${packType} pack`}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className={cn(config.icon, "text-white/80")} />
          )}
        </div>

        {/* Holographic overlay effect (mystery packs only) */}
        {packType === "mystery" && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent"
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

      {/* Quantity badge */}
      <div
        className={cn(
          "absolute -top-2 -right-2 z-10",
          "rounded-full border-2 border-white/40",
          "shadow-lg shadow-black/40",
          "font-bold",
          styles.text,
          config.badge,
          styles.badge.startsWith("vault-gradient-")
            ? `bg-[var(--${styles.badge})]`
            : `bg-gradient-to-br ${styles.badge}`
        )}
      >
        x{quantity}
      </div>
    </div>
  );
}
