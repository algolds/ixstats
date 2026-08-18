"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { tabVariants, tabFadeVariants, tabSpring, tabTween } from "./TabMotionConfig";

interface AnimatedTabContentProps {
  children: React.ReactNode;
  activeTab: string;
  direction?: number;
  mode?: "slide" | "fade";
  className?: string;
}

export function AnimatedTabContent({
  children,
  activeTab,
  direction = 0,
  mode = "slide",
  className = "",
}: AnimatedTabContentProps) {
  const variants = mode === "slide" ? tabVariants : tabFadeVariants;
  const transition = mode === "slide" ? tabSpring : tabTween;

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={activeTab}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={transition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Wrapper for tab triggers with hover animation
interface AnimatedTabTriggerProps {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AnimatedTabTrigger({
  children,
  isActive = false,
  onClick,
  className = "",
}: AnimatedTabTriggerProps) {
  return (
    <motion.button
      onClick={onClick}
      className={className}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={{
        backgroundColor: isActive ? "rgba(255, 255, 255, 0.1)" : "transparent",
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
    >
      {children}
    </motion.button>
  );
}

// Sliding indicator for active tab
interface TabIndicatorProps {
  layoutId?: string;
  className?: string;
}

export function TabIndicator({
  layoutId = "activeTabIndicator",
  className = "",
}: TabIndicatorProps) {
  return (
    <motion.div
      layoutId={layoutId}
      className={`absolute inset-0 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 ${className}`}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
    />
  );
}
