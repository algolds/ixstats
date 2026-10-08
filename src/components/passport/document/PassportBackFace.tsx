"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, EditPencil as Edit3, Pin, RotateCameraLeft as RotateCcw } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { TooltipProvider } from "~/components/ui/tooltip";
import { RibbonBar } from "~/components/achievements/FloatingRibbonRack";
import { IxnayPassportSeal } from "../cards/IxnayPassportSeal";
import type { PassportVisibility } from "../types";
import { Card } from "~/components/ui/card";

const VISIBILITY_TOGGLES: Array<{ key: keyof PassportVisibility; title: string; hint: string }> = [
  {
    key: "achievements",
    title: "Achievements",
    hint: "Achievements and ribbons (also on the country page)",
  },
  { key: "accolades", title: "Civic accolades", hint: "Lorewards score, rank and laurels" },
  { key: "impact", title: "Focus", hint: "Collection category breadth" },
  { key: "forumStats", title: "Forum activity", hint: "Message and reaction counts" },
  { key: "vaultCards", title: "IxCredits", hint: "IxCredits balance and collection" },
  { key: "historyStream", title: "Activity history", hint: "Your activity stream" },
];

/** Sharing controls: they change how the link looks elsewhere, not which sections it shows. */
const SHARING_TOGGLES: Array<{ key: keyof PassportVisibility; title: string; hint: string }> = [
  { key: "linkPreview", title: "Link previews", hint: "Show your card when your link is shared" },
];

/** Signature ribbon slots on the passport's showcase shelf. */
const MAX_PINS = 3;
const MAX_SIGNATURE = 60;

interface PassportBackFaceProps {
  isFlipped: boolean;
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
  displayName,
  isOwner,
  onDone,
}: PassportBackFaceProps) {
  const doneRef = useRef<HTMLButtonElement>(null);
  // The front face goes inert on flip, which drops focus; hand it to the back face instead.
  useEffect(() => {
    if (isFlipped) doneRef.current?.focus({ preventScroll: true });
  }, [isFlipped]);

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

  const renderToggle = (toggle: (typeof VISIBILITY_TOGGLES)[number]) => (
    <FacetRow
      key={toggle.key}
      title={toggle.title}
      subtitle={toggle.hint}
      trailing={
        <Switch
          aria-label={`Show ${toggle.title}`}
          checked={visibility?.[toggle.key] ?? true}
          disabled={!visibility || busy}
          onCheckedChange={(value) => update.mutate({ visibility: { [toggle.key]: value } })}
        />
      }
    />
  );

  return (
    <Card
      data-testid="passport-back-face"
      inert={!isFlipped}
      className={cn(
        "absolute inset-0 min-h-full w-full [transform:rotateY(180deg)] space-y-6 overflow-y-auto p-6 [backface-visibility:hidden] sm:p-8",
        "motion-reduce:[transform:none] motion-reduce:transition-opacity motion-reduce:duration-150",
        !isFlipped && "motion-reduce:pointer-events-none motion-reduce:opacity-0"
      )}
    >
      <div className="relative space-y-6">
        <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <IxnayPassportSeal size="sm" />
            <div>
              <h2 className="text-label text-title-3">Passport configuration</h2>
              <p className="text-label-secondary text-footnote">
                Signature, privacy and pinned ribbons
              </p>
            </div>
          </div>

          <Button ref={doneRef} type="button" variant="default" onClick={handleDone}>
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
          <Card variant="well" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-subhead text-label flex items-center gap-2">
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
                <span>Preview:</span>
                <span className="text-label text-body truncate font-serif italic">
                  {signature.trim() || displayName}
                </span>
              </div>
            </div>
          </Card>

          <FacetList>
            <FacetListSection
              header="Public passport sections"
              footer="Saved to your account. A hidden section is not sent to anyone viewing your passport, including you."
            >
              {VISIBILITY_TOGGLES.map(renderToggle)}
            </FacetListSection>
            <FacetListSection header="Sharing">
              {SHARING_TOGGLES.map(renderToggle)}
            </FacetListSection>
          </FacetList>
        </div>

        {/* Ribbon picker */}
        <Card variant="well" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-subhead text-label flex items-center gap-2">
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
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleDone}>
            <RotateCcw aria-hidden />
            <span>Return to passport</span>
          </Button>
        </div>
      </div>
    </Card>
  );
});
