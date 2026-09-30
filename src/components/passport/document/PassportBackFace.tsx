"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { Check, EditPencil as Edit3, Pin, RotateCameraLeft as RotateCcw } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FACET_CARD_SURFACE } from "~/components/ui/facet-container";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { tweenFast } from "~/lib/design/motion";
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
        FACET_CARD_SURFACE,
        "absolute inset-0 min-h-full w-full space-y-6 overflow-y-auto p-6 [backface-visibility:hidden] sm:p-8",
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
      transition={tweenFast}
    >
      <GuillochePattern opacity={0.05} />

      <div className="relative space-y-6">
        {/* Header */}
        <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <IxnayPassportSeal size="sm" />
            <div>
              <h2 className="text-label text-title-3">Passport configuration</h2>
              <p className="text-label-secondary text-footnote">
                Signature, privacy and signature ribbons
              </p>
            </div>
          </div>

          <Button type="button" variant="filled" onClick={handleDone}>
            <Check aria-hidden />
            <span>Done</span>
          </Button>
        </div>

        {update.error && (
          <p role="alert" className="text-destructive text-footnote">
            Could not save: {update.error.message}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Editable signature */}
          <div className="bg-surface-secondary rounded-row space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-subhead text-label flex items-center gap-1.5">
                <Edit3 aria-hidden className="text-label-secondary size-4" />
                <span>Signature inscription</span>
              </h3>
              <span className="text-label-secondary text-footnote">Saved on Done</span>
            </div>

            <div className="space-y-2">
              <Input
                type="text"
                value={signature}
                maxLength={MAX_SIGNATURE}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={displayName}
                aria-label="Signature inscription"
                className="bg-surface font-serif italic"
              />
              <div className="text-label-secondary text-footnote flex items-center justify-between gap-2">
                <span>Calligraphic preview:</span>
                <span className="text-label text-body truncate font-serif italic">
                  {signature.trim() || displayName}
                </span>
              </div>
            </div>
          </div>

          {/* Persisted visibility toggles */}
          <FacetList>
            <FacetListSection
              header="Public passport sections"
              footer="Saved to your account. A hidden section is not sent to anyone viewing your passport, including you."
            >
              {VISIBILITY_TOGGLES.map((toggle) => (
                <FacetRow
                  key={toggle.key}
                  title={toggle.title}
                  subtitle={toggle.hint}
                  trailing={
                    <Switch
                      aria-label={`Show ${toggle.title}`}
                      checked={visibility?.[toggle.key] ?? true}
                      disabled={!visibility || busy}
                      onCheckedChange={(value) =>
                        update.mutate({ visibility: { [toggle.key]: value } })
                      }
                    />
                  }
                />
              ))}
            </FacetListSection>
          </FacetList>
        </div>

        {/* Signature ribbon shelf picker */}
        <div className="bg-surface-secondary rounded-row space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-subhead text-label flex items-center gap-1.5">
              <Pin aria-hidden className="text-label-secondary size-4" />
              <span>Signature ribbons</span>
            </h3>
            <span className="text-label-secondary text-footnote tabular-nums">
              {pinned.length}/{MAX_PINS} pinned
            </span>
          </div>
          {ribbons.length === 0 ? (
            <p className="text-label-secondary text-footnote">
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
                          "rounded-row text-footnote duration-fast ease-out-facet focus-visible:outline-tint flex w-full cursor-pointer items-center gap-2 border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                          isPinned
                            ? "border-tint bg-tint-fill"
                            : "bg-surface border-separator hover:bg-fill-4"
                        )}
                      >
                        <RibbonBar ribbon={ribbon} />
                        <span className="text-label text-headline min-w-0 flex-1 truncate">
                          {ribbon.title}
                        </span>
                        {isPinned && <Pin aria-hidden className="text-tint size-3.5 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </TooltipProvider>
          )}
        </div>

        {/* Action footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="gray" onClick={handleDone}>
            <RotateCcw aria-hidden />
            <span>Return to Passport</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
});
