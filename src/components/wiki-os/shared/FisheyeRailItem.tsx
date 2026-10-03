"use client";
// Fisheye magnification icon wrapper.

import { useRef } from "react";
import { motion, useTransform, useSpring, type MotionValue } from "motion/react";

export const getActiveColorClass = (itemId: string): string => {
  switch (itemId) {
    case "search":
    case "backlinks":
      return "text-teal border-teal/30 bg-teal/10";
    case "main":
    case "edit":
      return "text-tint border-tint/30 bg-tint/10";
    case "recent":
    case "history":
      return "text-yellow border-yellow/30 bg-yellow/10";
    case "margin":
      return "text-(--margin-badge-text) border-yellow/60 bg-margin-accent";
    case "random":
      return "text-indigo border-indigo/30 bg-indigo/10";
    case "stashes":
      return "text-yellow border-yellow/30 bg-yellow/10";
    case "images":
    case "talk":
      return "text-indigo border-indigo/30 bg-indigo/10";
    case "utilities":
      return "text-teal border-teal/30 bg-teal/10";
    case "admin":
      return "text-red border-red/30 bg-red/10";
    case "lorewards":
      return "text-yellow border-yellow/30 bg-yellow/10";
    case "create-page":
      return "text-green border-green/30 bg-green/10";
    default:
      return "text-tint border-tint/30 bg-tint/10";
  }
};

interface FisheyeRailItemProps {
  mouseY: MotionValue<number>;
  isExpanded: boolean;
  children: React.ReactNode;
  index: number;
  onHover: (index: number | null) => void;
}

export function FisheyeRailItem({
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

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => onHover(index)}
      style={{ scale: springScale }}
      className="relative origin-center"
    >
      {children}
    </motion.div>
  );
}
