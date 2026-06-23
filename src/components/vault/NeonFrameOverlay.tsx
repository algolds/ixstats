import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import type { NeonFrameConfig } from "~/hooks/useActiveCosmetics";
import { CosmeticParticles } from "~/components/vault/CosmeticParticles";

interface NeonFrameOverlayProps {
  neonFrame: NeonFrameConfig;
  className?: string;
}

export function NeonFrameOverlay({ neonFrame, className }: NeonFrameOverlayProps) {
  if (!neonFrame.enabled) return null;

  const style = neonFrame.style;

  return (
    <motion.div
      className={cn(
        "pointer-events-none absolute inset-0 z-30 rounded-2xl",
        style === "ruby" &&
          "from-red-650/10 border-2 border-red-500 bg-gradient-to-r to-rose-600/10 shadow-[0_0_15px_rgba(239,68,68,0.7),_inset_0_0_10px_rgba(244,63,94,0.5)]",
        style === "winter" &&
          "border-2 border-sky-300 bg-gradient-to-br from-sky-400/15 via-teal-300/5 to-transparent shadow-[0_0_15px_rgba(56,189,248,0.7),_inset_0_0_12px_rgba(186,230,253,0.5)] after:absolute after:inset-0 after:rounded-2xl after:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent)]",
        style !== "ruby" && style !== "winter" && "border-2",
        className
      )}
      style={
        style !== "ruby" && style !== "winter"
          ? {
              borderColor: neonFrame.color || "#22d3ee",
              boxShadow: `0 0 12px ${neonFrame.color || "#22d3ee"}, inset 0 0 8px ${neonFrame.color || "#22d3ee"}`,
            }
          : undefined
      }
      animate={style === "pulse" ? { opacity: [0.5, 1, 0.5] } : undefined}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {/* Particle shapes rendering inside the border */}
      {style && (
        <CosmeticParticles style={style} containerType="frame" className="rounded-[inherit]" />
      )}
      {/* Winter Frost particles / snowflakes */}
      {style === "winter" && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <span className="absolute top-1 left-2 animate-bounce text-[8px] text-sky-200/50 select-none">
            ❄
          </span>
          <span className="absolute right-3 bottom-2 animate-pulse text-[10px] text-sky-200/60 select-none">
            ❄
          </span>
          <span className="absolute top-1/2 right-1 text-[7px] text-sky-100/40 select-none">❄</span>
        </div>
      )}
      {/* Ruby gem shimmer sweep effect */}
      {style === "ruby" && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            style={{
              transform: "skewX(-20deg)",
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: "linear",
              repeatDelay: 1,
            }}
          />
        </div>
      )}
    </motion.div>
  );
}
