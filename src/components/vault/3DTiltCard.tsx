"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: "gold" | "purple" | "cyan" | "blue" | "green" | "orange";
  showSparkles?: boolean;
  disableTilt?: boolean;
  onClick?: () => void;
}

export function TiltCard({
  children,
  className,
  glowColor = "gold",
  showSparkles = false,
  disableTilt = false,
  onClick,
}: TiltCardProps) {
  const { neonFrame } = useActiveCosmetics();
  const [isHovering, setIsHovering] = useState(false);

  // Mouse position tracking
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring physics for smooth animations
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), {
    stiffness: 300,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), {
    stiffness: 300,
    damping: 20,
  });

  // Handle mouse move for tilt effect
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disableTilt) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Normalize mouse position to -0.5 to 0.5 range
    x.set((event.clientX - centerX) / rect.width);
    y.set((event.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovering(false);
  };

  // Glow color mapping
  const glowColors = {
    gold: "rgba(251, 191, 36, 0.4)",
    purple: "rgba(168, 85, 247, 0.4)",
    cyan: "rgba(34, 211, 238, 0.4)",
    blue: "rgba(59, 130, 246, 0.4)",
    green: "rgba(34, 197, 94, 0.4)",
    orange: "rgba(249, 115, 22, 0.4)",
  };

  const glowClasses = {
    gold: "vault-glow-gold",
    purple: "vault-glow-purple",
    cyan: "vault-glow-cyan",
    blue: "",
    green: "",
    orange: "vault-glow-orange",
  };

  return (
    <motion.div
      style={{ perspective: 1000 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className={cn(
          "glass-hierarchy-child vault-tilt-card relative overflow-hidden transition-all duration-300",
          glowClasses[glowColor],
          onClick && "cursor-pointer",
          className
        )}
        style={{
          rotateX: disableTilt ? 0 : rotateX,
          rotateY: disableTilt ? 0 : rotateY,
          transformStyle: "preserve-3d",
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        whileHover={onClick ? { scale: 1.02 } : {}}
        whileTap={onClick ? { scale: 0.98 } : {}}
      >
        {/* Shimmer overlay on hover */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          animate={{
            background: isHovering
              ? "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)"
              : "transparent",
            backgroundPosition: isHovering ? ["0% 0%", "200% 200%"] : "0% 0%",
          }}
          transition={{ duration: 1.5, repeat: isHovering ? Infinity : 0 }}
          style={{ backgroundSize: "200% 200%" }}
        />

        {/* Sparkle effects on corners */}
        {showSparkles && isHovering && (
          <>
            {[
              { top: "8px", right: "8px", delay: 0 },
              { bottom: "8px", left: "8px", delay: 0.5 },
              { top: "8px", left: "8px", delay: 0.25 },
              { bottom: "8px", right: "8px", delay: 0.75 },
            ].map((position, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 1, repeat: Infinity, delay: position.delay }}
                className="absolute"
                style={position}
              >
                <Sparkles
                  className={cn(
                    "h-3 w-3",
                    glowColor === "gold"
                      ? "text-gold-400"
                      : glowColor === "purple"
                        ? "text-purple-400"
                        : glowColor === "cyan"
                          ? "text-cyan-400"
                          : "text-blue-400"
                  )}
                />
              </motion.div>
            ))}
          </>
        )}

        {/* Content (with 3D transform) */}
        <div style={{ transform: "translateZ(20px)" }}>{children}</div>

        {/* Neon Frame Overlay */}
        {neonFrame.enabled && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 rounded-xl"
            style={{
              border: `2px solid ${neonFrame.color}`,
              boxShadow: `0 0 12px ${neonFrame.color}, inset 0 0 8px ${neonFrame.color}`,
            }}
            animate={
              neonFrame.style === "pulse"
                ? {
                    opacity: [0.5, 1, 0.5],
                  }
                : undefined
            }
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Bottom glow line */}
        <motion.div
          className="absolute right-0 bottom-0 left-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, transparent, ${glowColors[glowColor]}, transparent)`,
          }}
          animate={{ opacity: isHovering ? [0.2, 0.4, 0.2] : 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.div>
    </motion.div>
  );
}

/**
 * Stat Card variant - pre-styled for statistics display
 */
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  glowColor?: TiltCardProps["glowColor"];
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

export function TiltStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  glowColor = "gold",
  trend,
  loading = false,
}: StatCardProps) {
  const TrendIcon =
    trend === "up"
      ? () => <span className="text-green-400">↗</span>
      : trend === "down"
        ? () => <span className="text-red-400">↘</span>
        : () => <span className="text-gray-400">→</span>;

  return (
    <TiltCard glowColor={glowColor} showSparkles={!loading}>
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/80">{title}</h3>
          <motion.div
            animate={{ rotate: loading ? 360 : 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                glowColor === "gold"
                  ? "text-gold-400"
                  : glowColor === "purple"
                    ? "text-purple-400"
                    : glowColor === "cyan"
                      ? "text-cyan-400"
                      : glowColor === "blue"
                        ? "text-blue-400"
                        : glowColor === "green"
                          ? "text-green-400"
                          : "text-orange-400"
              )}
            />
          </motion.div>
        </div>

        <div className="space-y-1">
          <div
            className={cn(
              "text-3xl font-black",
              glowColor === "gold"
                ? "text-gold-400"
                : glowColor === "purple"
                  ? "text-purple-400"
                  : glowColor === "cyan"
                    ? "text-cyan-400"
                    : glowColor === "blue"
                      ? "text-blue-400"
                      : glowColor === "green"
                        ? "text-green-400"
                        : "text-orange-400"
            )}
          >
            {loading ? (
              <div className="h-9 w-24 animate-pulse rounded bg-white/10" />
            ) : typeof value === "number" ? (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {value.toLocaleString()}
              </motion.span>
            ) : (
              value
            )}
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-white/60">{subtitle}</p>
            {trend && !loading && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center"
              >
                <TrendIcon />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </TiltCard>
  );
}
