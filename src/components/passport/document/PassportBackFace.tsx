"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { Check, EditPencil as Edit3, Pin, RotateCameraLeft as RotateCcw } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";
import { TooltipProvider } from "~/components/ui/tooltip";
import { RibbonBar } from "~/components/achievements/FloatingRibbonRack";
import { GuillochePattern } from "../cards/GuillochePattern";
import { IxnayPassportSeal } from "../cards/IxnayPassportSeal";
import type { PassportVisibility } from "../types";

const VISIBILITY_TOGGLES: Array<{ key: keyof PassportVisibility; title: string; hint: string }> = [
  {
    key: "achievements",
    title: "Achievements",
    hint: "Achievements & ribbons (also the country-page rack)",
  },
  { key: "accolades", title: "Civic Accolades", hint: "Lorewards score, rank & laurels" },
  { key: "impact", title: "Focus", hint: "Collection category breadth" },
  { key: "forumStats", title: "Forum Discussions", hint: "Message & reaction counters" },
  { key: "vaultCards", title: "IxCredits", hint: "IxCredits balance & collection" },
  { key: "historyStream", title: "Activity History", hint: "Activity stream" },
];

/** Signature ribbon slots on the passport's showcase shelf. */
const MAX_PINS = 3;
const MAX_SIGNATURE = 60;

interface PassportBackFaceProps {
  isFlipped: boolean;
  shouldReduceMotion: boolean;
  displayName: string;
  /** Only the owner can flip the passport; settings are loaded for the owner only. */
  isOwner: boolean;
  onDone: () => void;
}

/**
 * Back face of the passport (owner only): signature inscription, which sections the public passport
 * shows, and which ribbons sit on the signature shelf. Every change is saved to the owner's
 * `PassportPreference`; hidden sections are stripped from the passport server-side.
 */
export const PassportBackFace = React.memo(function PassportBackFace({
  isFlipped,
  shouldReduceMotion,
  displayName,
  isOwner,
  onDone,
}: PassportBackFaceProps) {
  const utils = api.useUtils();
  const settings = api.ixnayid.getPassportSettings.useQuery(undefined, { enabled: isOwner });
  const savedSignature = settings.data?.signature ?? "";
  const [signature, setSignature] = useState(savedSignature);
  // Reset the draft whenever the saved signature changes (first load, or after a save).
  const [syncedSignature, setSyncedSignature] = useState(savedSignature);
  if (syncedSignature !== savedSignature) {
    setSyncedSignature(savedSignature);
    setSignature(savedSignature);
  }

  const update = api.ixnayid.updatePassportSettings.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ixnayid.getPassportSettings.invalidate(),
        utils.ixnayid.getPassport.invalidate(),
        utils.ixnayid.getWork.invalidate(),
        utils.ixnayid.getHistory.invalidate(),
        utils.ixnayid.getRibbons.invalidate(),
        utils.ixnayid.getCountryRibbons.invalidate(),
      ]);
    },
  });

  const visibility = settings.data?.visibility;
  const ribbons = settings.data?.ribbons ?? [];
  const pinned = settings.data?.pinnedRibbonKeys ?? [];
  const busy = update.isPending || settings.isFetching;

  const togglePin = (key: string) => {
    const next = pinned.includes(key) ? pinned.filter((k) => k !== key) : [...pinned, key];
    if (next.length > MAX_PINS) return;
    update.mutate({ pinnedRibbonKeys: next });
  };

  const handleDone = () => {
    const trimmed = signature.trim();
    if (trimmed !== savedSignature) update.mutate({ signature: trimmed || null });
    onDone();
  };

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
                SIGNATURE, PRIVACY & SIGNATURE RIBBONS
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDone}
            data-cuelume-press="soft"
            className="bg-foreground text-background inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold shadow-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:opacity-90 active:scale-[0.97]"
          >
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span>Done</span>
          </button>
        </div>

        {update.error && (
          <p role="alert" className="text-destructive text-xs">
            Could not save: {update.error.message}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Editable Signature Block */}
          <div className="space-y-3.5 rounded-2xl border border-black/8 bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider text-stone-400 uppercase">
                <Edit3 className="h-3 w-3 text-blue-500" />
                <span>Signature Inscription</span>
              </span>
              <span className="text-muted-foreground font-mono text-xs">Saved on Done</span>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={signature}
                maxLength={MAX_SIGNATURE}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={displayName}
                aria-label="Signature inscription"
                className="text-foreground placeholder:text-muted-foreground w-full rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2 font-serif text-sm tracking-wide italic transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:ring-2 focus:ring-blue-500/30 focus:outline-none dark:border-white/15 dark:bg-white/[0.03]"
              />
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Calligraphic Preview:</span>
                <span className="text-foreground font-serif font-semibold italic">
                  {signature.trim() || displayName}
                </span>
              </div>
            </div>
          </div>

          {/* Persisted visibility toggles */}
          <div className="space-y-3.5 rounded-2xl border border-black/8 bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]">
            <span className="block font-mono text-xs font-bold tracking-wider text-stone-400 uppercase">
              Public Passport Sections
            </span>
            <p className="text-muted-foreground text-xs">
              Saved to your account. A hidden section is not sent to anyone viewing your passport,
              including you.
            </p>

            <div className="space-y-3 text-xs">
              {VISIBILITY_TOGGLES.map((toggle, idx) => (
                <div
                  key={toggle.key}
                  className={cn(
                    "flex items-center justify-between gap-3",
                    idx > 0 && "border-t border-black/6 pt-2 dark:border-white/8"
                  )}
                >
                  <div className="space-y-0.5">
                    <p className="text-foreground font-semibold">{toggle.title}</p>
                    <p className="text-muted-foreground text-xs">{toggle.hint}</p>
                  </div>
                  <Switch
                    aria-label={`Show ${toggle.title}`}
                    checked={visibility?.[toggle.key] ?? true}
                    disabled={!visibility || busy}
                    onCheckedChange={(value) =>
                      update.mutate({ visibility: { [toggle.key]: value } })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Signature ribbon shelf picker */}
        <div className="space-y-3 rounded-2xl border border-black/8 bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider text-stone-400 uppercase">
              <Pin className="h-3 w-3 text-amber-500" />
              <span>Signature Ribbons</span>
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              {pinned.length}/{MAX_PINS} pinned
            </span>
          </div>
          {ribbons.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Unlock achievements to earn ribbons. Without pins, your rarest ribbons lead the shelf.
            </p>
          ) : (
            <TooltipProvider delayDuration={100}>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ribbons.map((ribbon) => {
                  const isPinned = pinned.includes(ribbon.key);
                  const full = !isPinned && pinned.length >= MAX_PINS;
                  return (
                    <li key={ribbon.key}>
                      <button
                        type="button"
                        onClick={() => togglePin(ribbon.key)}
                        disabled={busy || full}
                        aria-pressed={isPinned}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border p-2 text-left text-xs transition-[background-color,border-color,opacity] disabled:cursor-not-allowed disabled:opacity-50",
                          isPinned
                            ? "border-amber-500/40 bg-amber-500/10"
                            : "border-black/8 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]"
                        )}
                      >
                        <RibbonBar ribbon={ribbon} />
                        <span className="text-foreground min-w-0 flex-1 truncate font-semibold">
                          {ribbon.title}
                        </span>
                        {isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </TooltipProvider>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleDone}
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
