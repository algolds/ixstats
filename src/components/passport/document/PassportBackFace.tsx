"use client";

import React from "react";
import { motion } from "motion/react";
import { Check, EditPencil as Edit3, RotateCameraLeft as RotateCcw } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";
import { GuillochePattern } from "../cards/GuillochePattern";
import { IxnayPassportSeal } from "../cards/IxnayPassportSeal";
import type { PassportVisibility } from "../types";

const VISIBILITY_TOGGLES: Array<{ key: keyof PassportVisibility; title: string; hint: string }> = [
  { key: "accolades", title: "Civic Accolades", hint: "Lorewards score & rank" },
  { key: "impact", title: "Focus", hint: "Category breadth" },
  { key: "forumStats", title: "Forum Discussions", hint: "Message & reaction counters" },
  { key: "vaultCards", title: "IxCredits", hint: "IxCredits & collection" },
  { key: "historyStream", title: "Activity History", hint: "Activity stream" },
];

interface PassportBackFaceProps {
  isFlipped: boolean;
  shouldReduceMotion: boolean;
  displayName: string;
  signature: string;
  onSignatureChange: (signature: string) => void;
  visibility: PassportVisibility;
  onVisibilityChange: (key: keyof PassportVisibility, value: boolean) => void;
  onDone: () => void;
}

/** Back face of the passport: signature inscription and session-only display toggles (owner only). */
export const PassportBackFace = React.memo(function PassportBackFace({
  isFlipped,
  shouldReduceMotion,
  displayName,
  signature,
  onSignatureChange,
  visibility,
  onVisibilityChange,
  onDone,
}: PassportBackFaceProps) {
  return (
    <motion.div
      className={cn(
        "bg-card/70 dark:bg-card/60 absolute inset-0 min-h-full w-full space-y-6 overflow-y-auto rounded-3xl border border-black/10 p-6 shadow-2xl saturate-[180%] backdrop-blur-[20px] [backface-visibility:hidden] sm:p-8 dark:border-white/15",
        !isFlipped ? "pointer-events-none" : ""
      )}
      style={
        shouldReduceMotion
          ? undefined
          : ({
              transform: "rotateY(180deg)",
              willChange: "transform, opacity",
            } as React.CSSProperties)
      }
      animate={{ opacity: isFlipped ? 1 : 0 }}
      transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.15 }}
    >
      <GuillochePattern opacity={0.05} />

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <IxnayPassportSeal size="sm" />
            <div>
              <span className="text-foreground block font-mono text-xs font-bold tracking-[0.2em] uppercase sm:text-xs">
                PASSPORT CONFIGURATION
              </span>
              <span className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
                SIGNATURE & DISPLAY OPTIONS
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onDone}
            data-cuelume-press="soft"
            className="bg-foreground text-background inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold shadow-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:opacity-90 active:scale-[0.97]"
          >
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span>Done</span>
          </button>
        </div>

        {/* Signature Inscription & Telemetry Toggles Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Editable Signature Block */}
          <div className="space-y-3.5 rounded-2xl border border-black/8 bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider text-stone-400 uppercase">
                <Edit3 className="h-3 w-3 text-blue-500" />
                <span>Signature Inscription</span>
              </span>
              <span className="text-muted-foreground font-mono text-xs">Front Biometric Panel</span>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={signature}
                onChange={(e) => onSignatureChange(e.target.value)}
                placeholder={displayName}
                className="text-foreground placeholder:text-muted-foreground w-full rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2 font-serif text-sm tracking-wide italic transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:ring-blue-500/30 focus:outline-none dark:border-white/15 dark:bg-white/[0.03]"
              />
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Calligraphic Preview:</span>
                <span className="text-foreground font-serif font-semibold italic">
                  {signature || displayName}
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry Visibility Toggles */}
          <div className="space-y-3.5 rounded-2xl border border-black/8 bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]">
            <span className="block font-mono text-xs font-bold tracking-wider text-stone-400 uppercase">
              Passport Display (This Session)
            </span>
            <p className="text-muted-foreground text-xs">
              These switches only change what you see here. They are not saved and do not hide
              anything from visitors: the public passport always shows these sections.
            </p>

            <div className="space-y-3 text-xs">
              {VISIBILITY_TOGGLES.map((toggle, idx) => (
                <div
                  key={toggle.key}
                  className={cn(
                    "flex items-center justify-between",
                    idx > 0 && "border-t border-black/6 pt-2 dark:border-white/8"
                  )}
                >
                  <div className="space-y-0.5">
                    <p className="text-foreground font-semibold">{toggle.title}</p>
                    <p className="text-muted-foreground text-xs">{toggle.hint}</p>
                  </div>
                  <Switch
                    checked={visibility[toggle.key]}
                    onCheckedChange={(value) => onVisibilityChange(toggle.key, value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onDone}
            data-cuelume-press="soft"
            className="bg-foreground text-background inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:opacity-90 active:scale-[0.97]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Return to Passport</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
