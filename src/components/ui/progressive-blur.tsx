"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "~/lib/utils";

interface ProgressiveBlurProps {
  children: React.ReactNode;
  revealContent: React.ReactNode;
  className?: string;
  blurIntensity?: number;
  gradientHeight?: number;
  arrowPosition?: "center" | "right";
}

export const ProgressiveBlur: React.FC<ProgressiveBlurProps> = ({
  children,
  revealContent,
  className,
  blurIntensity = 8,
  gradientHeight = 120,
  arrowPosition = "center",
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <div className={cn("relative", className)}>
      {/* Main content with progressive blur effect */}
      <div className="relative">
        {children}

        {/* Progressive blur overlay */}
        {!isRevealed && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{ height: `${gradientHeight}px` }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Glass refraction effect */}
            <div
              className="glass-refraction absolute inset-0"
              style={{
                background: `
                  linear-gradient(to top,
                    rgba(var(--background), 0.95) 0%,
                    rgba(var(--background), 0.85) 20%,
                    rgba(var(--background), 0.6) 40%,
                    rgba(var(--background), 0.3) 60%,
                    rgba(var(--background), 0.1) 80%,
                    transparent 100%
                  )`,
                backdropFilter: `blur(${blurIntensity}px) saturate(1.2)`,
                WebkitBackdropFilter: `blur(${blurIntensity}px) saturate(1.2)`,
              }}
            />

            {/* Glass depth effect */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(135deg,
                    rgba(255, 255, 255, 0.1) 0%,
                    transparent 25%,
                    rgba(255, 255, 255, 0.05) 50%,
                    transparent 75%,
                    rgba(255, 255, 255, 0.1) 100%
                  )`,
                mixBlendMode: "overlay",
              }}
            />

            {/* Subtle inner shadow for depth */}
            <div
              className="absolute inset-0"
              style={{
                boxShadow: `
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -1px 0 rgba(255, 255, 255, 0.05),
                  0 4px 12px rgba(0, 0, 0, 0.1)
                `,
              }}
            />
          </motion.div>
        )}
      </div>

      {/* Reveal button */}
      <motion.button
        className={cn(
          "absolute bottom-4 flex items-center gap-2 px-4 py-2",
          "glass-hierarchy-interactive glass-refraction rounded-full",
          "border border-white/20 backdrop-blur-xl",
          "bg-gradient-to-r from-white/10 via-white/5 to-white/10",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_12px_rgba(0,0,0,0.15)]",
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_24px_rgba(0,0,0,0.2)]",
          "text-foreground/80 hover:text-foreground transition-all duration-200",
          "pointer-events-auto",
          arrowPosition === "center" ? "left-1/2 -translate-x-1/2" : "right-4"
        )}
        onClick={() => setIsRevealed(!isRevealed)}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <span className="text-sm font-medium">{isRevealed ? "Show Less" : "Show More"}</span>
        <motion.div
          animate={{ rotate: isRevealed ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.button>

      {/* Revealed content */}
      <AnimatePresence>
        {isRevealed && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{
              duration: 0.5,
              ease: [0.4, 0.0, 0.2, 1],
              height: { duration: 0.4 },
            }}
            className="mt-4 overflow-hidden"
          >
            <div className="glass-hierarchy-child glass-refraction rounded-lg border border-white/10 p-4 backdrop-blur-sm">
              {revealContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProgressiveBlur;
