"use client";

import "~/styles/card-art.css";

import React, { useMemo } from "react";
import { springGentle } from "~/lib/design/motion";
import { motion, AnimatePresence } from "motion/react";
import { Sparks as Sparkles } from "iconoir-react";
import { IxCreditsSymbol } from "./IxCreditsSymbol";

export interface VaultParticle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

export interface VaultParticleExplosionModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  amount?: number;
  icon?: React.ReactNode;
  count?: number;
}

export function VaultParticleExplosionModal({
  open,
  title,
  subtitle,
  amount,
  icon,
  count = 30,
}: VaultParticleExplosionModalProps) {
  const particles: VaultParticle[] = useMemo(() => {
    if (!open) return [];
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      // oxlint-disable-next-line
      x: (Math.random() - 0.5) * 360,
      // oxlint-disable-next-line
      y: (Math.random() - 0.5) * 300 - 100,
      // oxlint-disable-next-line
      rotate: Math.random() * 360,
      // oxlint-disable-next-line
      scale: 0.6 + Math.random() * 0.7,
    }));
  }, [open, count]);

  return (
    <AnimatePresence>
      {open && (
        <div
          aria-live="polite"
          className="z-sheet pointer-events-none fixed inset-0 flex items-center justify-center bg-black/40"
        >
          <div className="relative">
            {/* Drifting Gold Coins / Particles */}
            {particles.map((p) => (
              <motion.div
                key={p.id}
                className="card-art-linear-br absolute flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 from-amber-400 to-yellow-500 p-1 text-amber-950 shadow-[0_0_8px_rgba(245,158,11,0.5)] select-none"
                initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
                animate={{
                  x: p.x,
                  y: p.y,
                  scale: p.scale,
                  opacity: [1, 1, 0],
                  rotate: p.rotate,
                }}
                transition={{ duration: 2.5, ease: "easeOut" }}
              >
                <IxCreditsSymbol decorative className="h-full w-full" strokeWidth={3.5} />
              </motion.div>
            ))}

            {/* Central Celebration Card */}
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={springGentle}
              className="bg-surface-elevated rounded-sheet border-separator shadow-sheet relative flex flex-col items-center border px-10 py-7 text-center"
            >
              <div className="bg-tint-fill text-tint mb-3 rounded-full p-4">
                {icon || <Sparkles className="h-7 w-7" />}
              </div>
              <h3 className="text-label text-title-3">{title}</h3>
              {amount !== undefined && (
                <p className="text-large-title text-label mt-2 flex items-center justify-center gap-1 tabular-nums">
                  +<IxCreditsSymbol className="text-yellow h-7 w-7 shrink-0" />
                  {amount.toLocaleString()}
                </p>
              )}
              {subtitle && (
                <p className="text-callout text-label-secondary mt-2 max-w-[240px]">{subtitle}</p>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
