"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
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
      x: (Math.random() - 0.5) * 360,
      y: (Math.random() - 0.5) * 300 - 100,
      rotate: Math.random() * 360,
      scale: 0.6 + Math.random() * 0.7,
    }));
  }, [open, count]);

  return (
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative">
            {/* Drifting Gold Coins / Particles */}
            {particles.map((p) => (
              <motion.div
                key={p.id}
                className="absolute flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-gradient-to-br from-amber-400 to-yellow-500 p-1 text-amber-950 shadow-[0_0_8px_rgba(245,158,11,0.5)] select-none"
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: p.x,
                  y: p.y,
                  scale: p.scale,
                  opacity: [1, 1, 0],
                  rotate: p.rotate,
                }}
                transition={{ duration: 2.5, ease: "easeOut" }}
              >
                <IxCreditsSymbol className="h-full w-full" strokeWidth={3.5} />
              </motion.div>
            ))}

            {/* Central Celebration Card */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.8, 1.05, 1], opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-popover/95 relative flex flex-col items-center rounded-2xl border border-amber-500/35 border-t-amber-400/50 px-10 py-7 text-center shadow-[0_0_40px_rgba(245,158,11,0.25)] dark:bg-slate-950/95"
            >
              <div className="mb-3 animate-bounce rounded-full border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-400">
                {icon || <Sparkles className="h-7 w-7" />}
              </div>
              <h3 className="text-foreground text-lg font-black tracking-wider uppercase dark:text-white">
                {title}
              </h3>
              {amount !== undefined && (
                <p className="mt-2 flex items-center justify-center gap-1 font-mono text-3xl font-extrabold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                  +<IxCreditsSymbol className="h-7 w-7 shrink-0 text-amber-400" />
                  {amount.toLocaleString()}
                </p>
              )}
              {subtitle && (
                <p className="mt-2 max-w-[240px] text-xs text-slate-400 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
