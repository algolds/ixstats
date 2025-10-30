"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import {
  TrendingUp,
  Building2,
  Users,
  DollarSign,
  Globe,
  Settings,
  BarChart3,
  PieChart,
  Gauge,
  Zap,
  Brain,
  Leaf,
  Target,
  Factory,
  Heart,
  Shield,
  Crown,
  Star,
  Sparkles,
} from "lucide-react";

interface GlobalBuilderLoadingProps {
  message?: string;
  className?: string;
  variant?: "full" | "compact" | "minimal";
  showSubsystems?: boolean;
}

/**
 * GlobalBuilderLoading - Comprehensive loading animation for the entire builder
 *
 * Features the economic growth chart animation from the economy builder
 * combined with subsystem indicators and builder-specific theming.
 *
 * @param message - Custom loading message
 * @param className - Additional CSS classes
 * @param variant - Loading display variant (full, compact, minimal)
 * @param showSubsystems - Whether to show subsystem loading indicators
 */
export function GlobalBuilderLoading({
  message = "Building your nation...",
  className,
  variant = "full",
  showSubsystems = true,
}: GlobalBuilderLoadingProps) {
  const sizeClass =
    variant === "minimal" ? "w-6 h-6" : variant === "compact" ? "w-12 h-12" : "w-16 h-16";

  // Subsystem icons and colors for the builder
  const subsystems = [
    { icon: Building2, color: "text-blue-500", label: "Government" },
    { icon: DollarSign, color: "text-green-500", label: "Economy" },
    { icon: Users, color: "text-purple-500", label: "Society" },
    { icon: Globe, color: "text-amber-500", label: "Diplomacy" },
    { icon: Shield, color: "text-red-500", label: "Security" },
    { icon: Heart, color: "text-pink-500", label: "Welfare" },
  ];

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
        <span className="text-muted-foreground text-sm">{message}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 p-4", className)}>
        <div className="relative">
          {/* Economic growth chart simulation */}
          <div className="absolute inset-0 flex items-end justify-center gap-1">
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "30%",
                animationDelay: "0s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "60%",
                animationDelay: "0.2s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "45%",
                animationDelay: "0.4s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "80%",
                animationDelay: "0.6s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "70%",
                animationDelay: "0.8s",
                animationDuration: "1.5s",
              }}
            />
          </div>

          {/* GDP trend line */}
          <div className="absolute inset-0 flex items-center">
            <div
              className="h-px w-full animate-pulse bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 opacity-60"
              style={{ animationDuration: "2s" }}
            />
          </div>
        </div>

        <div className="text-center">
          <p className="text-foreground text-sm font-medium">{message}</p>
        </div>
      </div>
    );
  }

  // Full variant with all features
  return (
    <div
      className={cn(
        "from-background via-background flex min-h-screen items-center justify-center bg-gradient-to-br to-amber-50/10",
        className
      )}
    >
      <div className="mx-auto max-w-2xl space-y-8 p-8 text-center">
        {/* Main loading animation */}
        <div className="relative">
          <div className="relative mx-auto h-24 w-24">
            {/* Economic growth chart simulation */}
            <div className="absolute inset-0 flex items-end justify-center gap-1">
              <div
                className="w-1 animate-pulse rounded-t bg-emerald-500"
                style={{
                  height: "30%",
                  animationDelay: "0s",
                  animationDuration: "1.5s",
                }}
              />
              <div
                className="w-1 animate-pulse rounded-t bg-emerald-500"
                style={{
                  height: "60%",
                  animationDelay: "0.2s",
                  animationDuration: "1.5s",
                }}
              />
              <div
                className="w-1 animate-pulse rounded-t bg-emerald-500"
                style={{
                  height: "45%",
                  animationDelay: "0.4s",
                  animationDuration: "1.5s",
                }}
              />
              <div
                className="w-1 animate-pulse rounded-t bg-emerald-500"
                style={{
                  height: "80%",
                  animationDelay: "0.6s",
                  animationDuration: "1.5s",
                }}
              />
              <div
                className="w-1 animate-pulse rounded-t bg-emerald-500"
                style={{
                  height: "70%",
                  animationDelay: "0.8s",
                  animationDuration: "1.5s",
                }}
              />
            </div>

            {/* GDP trend line */}
            <div className="absolute inset-0 flex items-center">
              <div
                className="h-px w-full animate-pulse bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 opacity-60"
                style={{ animationDuration: "2s" }}
              />
            </div>

            {/* Central spinning indicator */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            </div>
          </div>
        </div>

        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-8 w-8 text-amber-500" />
            <h2 className="text-foreground text-3xl font-bold">MyCountry Builder</h2>
            <Sparkles className="h-6 w-6 animate-pulse text-amber-500" />
          </div>

          <p className="text-muted-foreground mx-auto max-w-xl text-lg">{message}</p>
        </motion.div>

        {/* Subsystem indicators */}
        {showSubsystems && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-4 pt-6 md:grid-cols-6"
          >
            {subsystems.map((subsystem, index) => (
              <motion.div
                key={subsystem.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="rounded-lg border border-white/20 bg-white/50 p-3 backdrop-blur-sm">
                  <subsystem.icon className={cn("h-6 w-6", subsystem.color)} />
                </div>
                <div className="text-muted-foreground text-center text-xs">{subsystem.label}</div>
                <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{
                      delay: 1 + index * 0.2,
                      duration: 1.5,
                      ease: "easeOut",
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Progress indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex items-center justify-center gap-2 pt-4"
        >
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="h-2 w-2 rounded-full bg-amber-500"
                animate={{
                  opacity: [0.3, 1, 0.3],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * BuilderStepLoading - Loading animation for individual builder steps
 *
 * A more compact version for use within builder steps
 */
export function BuilderStepLoading({
  message = "Loading step...",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center p-8", className)}>
      <div className="space-y-4 text-center">
        <div className="relative mx-auto h-16 w-16">
          {/* Economic growth chart simulation */}
          <div className="absolute inset-0 flex items-end justify-center gap-1">
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "30%",
                animationDelay: "0s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "60%",
                animationDelay: "0.2s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "45%",
                animationDelay: "0.4s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "80%",
                animationDelay: "0.6s",
                animationDuration: "1.5s",
              }}
            />
            <div
              className="w-1 animate-pulse rounded-t bg-emerald-500"
              style={{
                height: "70%",
                animationDelay: "0.8s",
                animationDuration: "1.5s",
              }}
            />
          </div>

          {/* GDP trend line */}
          <div className="absolute inset-0 flex items-center">
            <div
              className="h-px w-full animate-pulse bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 opacity-60"
              style={{ animationDuration: "2s" }}
            />
          </div>

          {/* Central spinning indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        </div>

        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
