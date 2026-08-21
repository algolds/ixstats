// src/components/wiki-os/shared/FisheyeRailItem.tsx
// Fisheye magnification icon wrapper with physics-based spring glow.

"use client";

import { useRef } from "react";
import { motion, useTransform, useSpring, type MotionValue } from "motion/react";

export const getGlowColor = (id: string): string => {
  switch (id) {
    case "search":
    case "backlinks":
      return "rgba(20, 184, 166, 0.45)";
    case "main":
    case "edit":
      return "rgba(59, 130, 246, 0.45)";
    case "recent":
    case "history":
      return "rgba(245, 158, 11, 0.45)";
    case "random":
      return "rgba(99, 102, 241, 0.45)";
    case "stashes":
      return "rgba(244, 63, 94, 0.45)";
    case "images":
    case "talk":
      return "rgba(168, 85, 247, 0.45)";
    case "lorewards":
      return "rgba(234, 179, 8, 0.45)";
    case "create-page":
      return "rgba(16, 185, 129, 0.45)";
    default:
      return "rgba(255, 255, 255, 0.15)";
  }
};

export const getActiveColorClass = (itemId: string): string => {
  switch (itemId) {
    case "search":
    case "backlinks":
      return "text-teal-400 border-teal-500/30 bg-teal-500/10";
    case "main":
    case "edit":
      return "text-blue-400 border-blue-500/30 bg-blue-500/10";
    case "recent":
    case "history":
      return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "random":
      return "text-indigo-400 border-indigo-500/30 bg-indigo-500/10";
    case "images":
    case "talk":
      return "text-purple-400 border-purple-500/30 bg-purple-500/10";
    case "lorewards":
      return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "create-page":
      return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    default:
      return "text-blue-400 border-blue-500/30 bg-blue-500/10";
  }
};

interface FisheyeRailItemProps {
  id: string;
  mouseY: MotionValue<number>;
  isExpanded: boolean;
  title: string;
  children: React.ReactNode;
  index: number;
  onHover: (index: number | null) => void;
}

export function FisheyeRailItem({
  id,
  mouseY,
  isExpanded,
  children,
  index,
  onHover,
}: FisheyeRailItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseY, (val) => {
    if (!ref.current || val === Infinity) return Infinity;
    const bounds = ref.current.getBoundingClientRect();
    const center = bounds.top + bounds.height / 2;
    return val - center;
  });

  const scale = useTransform(distance, (d) => {
    if (isExpanded || d === Infinity) return 1.0;
    const maxMag = 0.3; // 1.3 max scale
    const stdDev = 40; // Pixels of influence
    const factor = Math.exp(-Math.pow(d, 2) / (2 * Math.pow(stdDev, 2)));
    return 1 + maxMag * factor;
  });

  const springScale = useSpring(scale, { stiffness: 250, damping: 20 });
  const glowOpacity = useTransform(scale, [1.0, 1.3], [0, 0.45]);
  const springGlowOpacity = useSpring(glowOpacity, { stiffness: 250, damping: 20 });
  const glowColor = getGlowColor(id);

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => onHover(index)}
      style={{ scale: springScale }}
      className="relative origin-center"
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-xl blur-md"
        style={{
          boxShadow: `0 0 16px 3px ${glowColor}`,
          opacity: springGlowOpacity,
        }}
      />
      {children}
    </motion.div>
  );
}
