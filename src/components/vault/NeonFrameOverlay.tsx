import "~/styles/card-art.css";
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
        "rounded-card pointer-events-none absolute inset-0 z-30",
        style === "ruby" &&
          "card-art-linear-r border-2 border-red-500 from-red-500/10 to-red-600/10 shadow-[0_0_8px_rgba(239,68,68,0.3),_inset_0_0_4px_rgba(239,68,68,0.2)]",
        style === "winter" &&
          "card-art-linear-br after:rounded-card border-2 border-cyan-300 from-cyan-400/15 via-cyan-300/5 to-transparent shadow-[0_0_8px_rgba(6,182,212,0.3),_inset_0_0_4px_rgba(6,182,212,0.2)] after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent)]",
        style !== "ruby" && style !== "winter" && "border-2",
        className
      )}
      style={
        style !== "ruby" && style !== "winter"
          ? {
              borderColor: neonFrame.color || "#06b6d4",
              boxShadow: `0 0 8px ${neonFrame.color || "rgba(6,182,212,0.25)"}, inset 0 0 4px ${neonFrame.color || "rgba(6,182,212,0.15)"}`,
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
      {/* Winter snowflakes come from CosmeticParticles (SVG_SNOWFLAKE) above. */}
      {/* Ruby gem shimmer sweep effect */}
      {style === "ruby" && (
        <div className="rounded-card absolute inset-0 overflow-hidden">
          <motion.div
            className="card-art-linear-r absolute inset-0 from-transparent via-white/20 to-transparent"
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
