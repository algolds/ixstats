"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import React, { useState } from "react";

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badge?: number; // Badge count for notifications
  badgeColor?: string; // Badge color (default: gold)
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

/**
 * QuickActions Component
 * Premium 3D card-flip animations with holographic overlays
 * Features:
 * - 3D tilt effect on mouse movement
 * - Holographic gradient overlay
 * - Particle burst on click
 * - Glass hierarchy depth
 * - Mobile-optimized touch interactions
 */
const QuickActionCard = React.memo(({ action, index }: { action: QuickAction; index: number }) => {
  const Icon = action.icon;
  const hasBadge = action.badge !== undefined && action.badge > 0;
  const badgeColor = action.badgeColor ?? "gold";

  // Mouse position for 3D tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring animation for smooth tilt
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [10, -10]), {
    stiffness: 200,
    damping: 15,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), {
    stiffness: 200,
    damping: 15,
  });

  // State for particle burst effect
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovering(false);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Create particle burst effect
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: clickX,
      y: clickY,
    }));

    setParticles(newParticles);

    // Clear particles after animation
    setTimeout(() => {
      setParticles([]);
    }, 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      style={{ perspective: 1000 }}
    >
      <Link href={action.href}>
        <motion.div
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          whileTap={{ scale: 0.95 }}
          className="relative"
        >
          <Card className="glass-hierarchy-child group vault-glow-holographic relative h-full cursor-pointer overflow-hidden transition-all duration-300">
            {/* Badge indicator with pulse animation */}
            {hasBadge && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-3 right-3 z-10"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={cn(
                    "flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-bold text-white",
                    badgeColor === "gold" && "bg-gold-500 shadow-gold-500/30 shadow-lg",
                    badgeColor === "purple" && "bg-purple-500 shadow-lg shadow-purple-500/30",
                    badgeColor === "blue" && "bg-blue-500 shadow-lg shadow-blue-500/30",
                    badgeColor === "green" && "bg-green-500 shadow-lg shadow-green-500/30"
                  )}
                >
                  {action.badge! > 99 ? "99+" : action.badge}
                </motion.div>
              </motion.div>
            )}

            {/* Holographic gradient overlay */}
            <motion.div
              className="absolute inset-0 opacity-0 transition-opacity duration-300"
              style={{
                background: `radial-gradient(600px circle at ${x.get() * 100 + 50}% ${y.get() * 100 + 50}%, rgba(147, 51, 234, 0.15), transparent 40%)`,
              }}
              animate={{ opacity: isHovering ? 1 : 0 }}
            />

            {/* Shimmer effect on hover */}
            <motion.div
              className="absolute inset-0 opacity-0"
              animate={{ opacity: isHovering ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                style={{ backgroundSize: "200% 100%" }}
              />
            </motion.div>

            {/* Particle burst effect */}
            {particles.map((particle, i) => (
              <motion.div
                key={particle.id}
                className="absolute h-2 w-2 rounded-full"
                style={{
                  left: particle.x,
                  top: particle.y,
                  background:
                    "linear-gradient(135deg, var(--vault-purple-start), var(--vault-gold-start))",
                }}
                initial={{ scale: 1, opacity: 1 }}
                animate={{
                  x: Math.cos((i * Math.PI * 2) / 8) * 50,
                  y: Math.sin((i * Math.PI * 2) / 8) * 50,
                  scale: 0,
                  opacity: 0,
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            ))}

            <div
              className="relative flex flex-col items-center gap-4 p-6 text-center sm:p-8"
              style={{ transform: "translateZ(20px)" }}
            >
              {/* Icon with 3D depth and glow */}
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-full blur-xl"
                  animate={{
                    background: isHovering
                      ? [
                          "rgba(147, 51, 234, 0.3)",
                          "rgba(255, 215, 0, 0.3)",
                          "rgba(147, 51, 234, 0.3)",
                        ]
                      : "rgba(147, 51, 234, 0.2)",
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="relative rounded-full bg-purple-500/10 p-5"
                  style={{
                    transform: "translateZ(30px)",
                  }}
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Icon className="h-10 w-10 text-purple-400" />
                </motion.div>
              </div>

              {/* Text content */}
              <motion.div className="space-y-1" style={{ transform: "translateZ(25px)" }}>
                <h3 className="text-xl font-bold text-purple-300">{action.label}</h3>
                {action.description && (
                  <motion.p
                    className="text-muted-foreground text-sm"
                    animate={{
                      color: isHovering
                        ? "hsl(var(--foreground) / 0.7)"
                        : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {action.description}
                  </motion.p>
                )}
              </motion.div>
            </div>

            {/* Bottom shine effect */}
            <motion.div
              className="absolute right-0 bottom-0 left-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(147, 51, 234, 0.5), rgba(255, 215, 0, 0.5), transparent)",
              }}
              animate={{ opacity: isHovering ? [0.3, 0.7, 0.3] : 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </Card>
        </motion.div>
      </Link>
    </motion.div>
  );
});

QuickActionCard.displayName = "QuickActionCard";

export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div className={cn("grid gap-4 sm:gap-5 md:grid-cols-3", className)}>
      {actions.map((action, index) => (
        <QuickActionCard key={action.href} action={action} index={index} />
      ))}
    </div>
  );
}
