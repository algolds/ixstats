/**
 * DashboardLayout Component
 *
 * Manages the responsive grid layout for dashboard cards:
 * - Bento-style grid system
 * - Dynamic column spanning based on card visibility
 * - Smooth transitions and animations
 * - Section separators
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn("max-w-7xl mx-auto space-y-6", className)}
    >
      {children}
    </motion.div>
  );
}

interface DashboardRowProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardRow({ children, className }: DashboardRowProps) {
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6", className)}>
      {children}
    </div>
  );
}

interface DashboardSectionProps {
  title: string;
  className?: string;
}

export function DashboardSeparator({ title, className }: DashboardSectionProps) {
  return (
    <div className={cn("relative my-8", className)}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-neutral-200 dark:border-white/[0.2]" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="glass-hierarchy-parent px-4 py-2 rounded-full text-muted-foreground">{title}</span>
      </div>
    </div>
  );
}
