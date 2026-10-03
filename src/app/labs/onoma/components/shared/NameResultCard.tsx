"use client";

// src/app/labs/onoma/components/shared/NameResultCard.tsx
// Onoma Lab — Card component to display individual generated names

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Copy,
  Check,
  Bookmark,
  ArrowUpRight,
  SystemRestart as Loader2,
  SoundHigh as Volume2,
  Translate as Languages,
  EditPencil as Pencil,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { translateToIPA } from "~/lib/onoma/phonology";
import {
  resolveIpa,
  getNameOverride,
  setNameOverride,
  OVERRIDES_UPDATED_EVENT,
} from "~/lib/onoma/ipa-overrides";
import { getMorphologyDetails } from "~/lib/onoma/morphology";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { speakName } from "~/lib/onoma/browser-speech";
import { classifyCulture } from "~/lib/onoma/lexicon/culture-classifier";
import { PronunciationEditor } from "./PronunciationEditor";
import { LinguisticProfile } from "./LinguisticProfile";
import { Button } from "~/components/ui/button";
import { ActionPill } from "~/components/ui/action-pill";
import { Toggle } from "~/components/ui/toggle";
import { Card } from "~/components/ui/card";

interface NameResultCardProps {
  name: string;
  isSaved?: boolean;
  onSave?: (name: string, stashId?: string) => Promise<any> | void;
  onUse?: (name: string) => void;
  culture?: string;
  /** Phonotactic naturalness 0–100 vs the training set. */
  naturalness?: number | null;
  /** Stash metadata — shown in the expanded details panel. */
  savedAt?: Date | string | null;
  /** What kind of word this is, e.g. "Category: Person" or "Dictionary: Elvish". */
  originLabel?: string | null;
  /** Extra action buttons (e.g. move-to-folder, delete) rendered in the header row. */
  headerExtras?: React.ReactNode;
  allowCustomize?: boolean;
  expandOnCardClick?: boolean;
}

export function NameResultCard({
  name,
  isSaved = false,
  onSave,
  onUse,
  culture,
  naturalness,
  savedAt,
  originLabel,
  headerExtras,
  allowCustomize = false,
  expandOnCardClick = false,
}: NameResultCardProps) {
  const notify = useNotify();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localSaved, setLocalSaved] = useState(isSaved);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Per-name pronunciation editor (IPA + voice overrides, stored in localStorage)
  const [mounted, setMounted] = useState(false);
  const [overridesVersion, setOverridesVersion] = useState(0);
  const [editingPron, setEditingPron] = useState(false);
  const [ipaDraft, setIpaDraft] = useState("");
  const [voiceDraft, setVoiceDraft] = useState("");

  // Load public speech config (including Kokoro settings)
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  // Apply localStorage overrides only after mount to avoid SSR hydration mismatch,
  // and re-resolve when any override changes (event from ipa-overrides helpers).
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const bump = () => setOverridesVersion((v) => v + 1);
    window.addEventListener(OVERRIDES_UPDATED_EVENT, bump);
    return () => window.removeEventListener(OVERRIDES_UPDATED_EVENT, bump);
  }, []);

  const resolvedCulture = useMemo(() => {
    if (!culture || culture === "any") {
      return classifyCulture(name).culture;
    }
    return culture;
  }, [name, culture]);

  const ipa = useMemo(() => {
    // SSR/first render: base translation (no localStorage) so markup matches the server.
    return mounted ? resolveIpa(name, resolvedCulture) : translateToIPA(name, resolvedCulture);
    // overridesVersion bumps when a localStorage override changes, forcing a re-resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, resolvedCulture, mounted, overridesVersion]);

  const hasOverride = mounted ? Boolean(getNameOverride(name)) : false;

  const morphology = useMemo(() => {
    return getMorphologyDetails(name, resolvedCulture);
  }, [name, resolvedCulture]);

  // Shared playback: prefer Kokoro (phoneme mode from the resolved IPA), fall back to browser.
  //  - forceDefaultVoice → 🔊 reads exact phonemes in the configured default voice
  //  - voice / ipaText   → explicit overrides (used by the per-name editor preview)
  //  - otherwise          → per-name override → per-culture map → default (server resolves)
  const playName = (opts?: { forceDefaultVoice?: boolean; ipaText?: string; voice?: string }) =>
    speakName({
      name,
      ipa: opts?.ipaText ?? ipa,
      culture: resolvedCulture,
      kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
      voice: opts?.voice ?? getNameOverride(name)?.voice,
      defaultVoice: speechConfig?.kokoro?.voice,
      forceDefaultVoice: opts?.forceDefaultVoice,
    });

  // 🔊 Pronounce — exact phonemes.
  const handlePlayPronunciation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await playName({ forceDefaultVoice: false });
    } catch (err) {
      console.error("Pronunciation playback failed:", err);
      notify.error("Could not play this pronunciation.");
    }
  };

  const previewPron = async () => {
    try {
      await playName({ ipaText: ipaDraft.trim() || ipa, voice: voiceDraft || undefined });
    } catch (err) {
      console.error("Preview playback failed:", err);
      notify.error("Could not play this preview.");
    }
  };

  const openPronEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ov = getNameOverride(name);
    setIpaDraft(ov?.ipa ?? ipa);
    setVoiceDraft(ov?.voice ?? "");
    setEditingPron(true);
  };

  const savePron = () => {
    setNameOverride(name, { ipa: ipaDraft.trim() || undefined, voice: voiceDraft || undefined });
    setEditingPron(false);
  };

  const resetPron = () => {
    setNameOverride(name, { ipa: undefined, voice: undefined });
    setEditingPron(false);
  };

  // Sync prop changes to local state
  useEffect(() => {
    setLocalSaved(isSaved);
  }, [isSaved, name]);

  const handleCopy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleSave = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!onSave || localSaved || saving) return;
    setSaving(true);
    try {
      await onSave(name);
      setLocalSaved(true);
    } catch (err) {
      console.error("Failed to save name:", err);
    } finally {
      setSaving(false);
    }
  };

  const dynamicFontSize = useMemo(() => {
    const len = name.length;
    if (len <= 7) return "1.375rem"; // 22px
    if (len <= 10) return "1.25rem"; // 20px
    if (len <= 13) return "1.125rem"; // 18px
    if (len <= 16) return "1rem"; // 16px
    if (len <= 20) return "0.875rem"; // 14px
    if (len <= 25) return "0.775rem"; // ~12.4px
    if (len <= 30) return "0.7rem"; // ~11.2px
    // Smoothly scale down for extreme compounds so they always remain on 1 single line
    const px = Math.max(9.5, 11 - (len - 30) * 0.25);
    return `${px}px`;
  }, [name]);

  const dynamicIpaFontSize = useMemo(() => {
    if (!ipa) return undefined;
    const len = ipa.length;
    if (len <= 14) return undefined;
    if (len <= 20) return "10px";
    return "9.5px";
  }, [ipa]);

  const fitColor =
    typeof naturalness === "number"
      ? naturalness >= 66
        ? "emerald"
        : naturalness >= 33
          ? "amber"
          : "red"
      : null;

  return (
    <Card
      variant="inset"
      padding="none"
      onClick={expandOnCardClick ? () => setShowDetailsModal(!showDetailsModal) : undefined}
      className={cn(
        "group rounded-card relative flex flex-col justify-start gap-4 overflow-hidden border px-4 py-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ease-out",
        expandOnCardClick && "cursor-pointer select-none",
        // Default border/background colors matching the fit score
        fitColor === "emerald" && "border-green/20 bg-emerald-500/[0.015]",
        fitColor === "amber" && "border-yellow/20 bg-amber-500/[0.015]",
        fitColor === "red" && "border-red/10 bg-red-500/[0.01]",
        !fitColor && "border-separator bg-fill-4",
        // Expanded details modal border styles
        showDetailsModal
          ? cn(
              "shadow-floating z-20 col-span-1 ring-1 sm:col-span-2",
              fitColor === "emerald" && "border-green/35 ring-green/20",
              fitColor === "amber" && "border-yellow/35 ring-yellow/20",
              fitColor === "red" && "border-red/25 ring-red/10",
              !fitColor && "border-tint/30 bg-tint/5 ring-tint/10"
            )
          : cn(
              "z-10 col-span-1",
              fitColor === "emerald" && "hover:border-green/40 hover:shadow-card",
              fitColor === "amber" && "hover:border-yellow/40 hover:shadow-card",
              fitColor === "red" && "hover:border-red/30 hover:shadow-card",
              !fitColor && "hover:border-tint/40 hover:shadow-card"
            )
      )}
      interactive
    >
      {/* Main Top Row */}
      <div className="relative z-10 flex w-full min-w-0 items-start justify-between gap-3">
        {/* Name Display Stack */}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <span
            className="text-label group-hover:text-tint w-full leading-none font-semibold whitespace-nowrap transition-colors duration-300"
            style={{ fontSize: dynamicFontSize }}
            title={name}
          >
            {name}
          </span>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
            {/* IPA badge — click to hear the exact phonetic pronunciation */}
            {ipa && (
              <span className="flex min-w-0 flex-shrink-0 items-center">
                <ActionPill
                  onClick={handlePlayPronunciation}
                  title="Click to hear phonetic pronunciation"
                  aria-label={`Play pronunciation /${ipa}/`}
                  icon={<Volume2 className="text-tint" />}
                  className={cn(
                    "border-separator bg-fill-4 hover:bg-tint/10 hover:text-tint border font-mono tracking-[0.02em]",
                    allowCustomize && "rounded-r-none",
                    hasOverride && "border-tint/40 text-tint"
                  )}
                  style={dynamicIpaFontSize ? { fontSize: dynamicIpaFontSize } : undefined}
                >
                  {ipa}
                </ActionPill>
                {allowCustomize && (
                  <ActionPill
                    onClick={openPronEditor}
                    title={hasOverride ? "Edit custom pronunciation" : "Customize IPA / voice"}
                    aria-label={hasOverride ? "Edit custom pronunciation" : "Customize IPA / voice"}
                    icon={<Pencil />}
                    className="border-separator bg-fill-4 hover:bg-tint/10 hover:text-tint rounded-l-none border border-l-0 px-2"
                  />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={cn(
            "border-separator bg-surface rounded-control shadow-card flex flex-shrink-0 items-center gap-0.5 border px-1 py-0.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ease-out select-none",
            showDetailsModal
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
          )}
        >
          {/* Linguistic Details Button (Toggles expand/shrink) */}
          <Toggle
            size="sm"
            pressed={showDetailsModal}
            onClick={(e) => e.stopPropagation()}
            onPressedChange={setShowDetailsModal}
            title={showDetailsModal ? "Hide linguistic details" : "Show linguistic details"}
            aria-label="Linguistic details"
            className="text-label-secondary hover:text-tint px-0"
          >
            <Languages className="h-4 w-4" />
          </Toggle>

          {/* Copy Button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            title="Copy name to clipboard"
            aria-label="Copy name to clipboard"
            className="text-label-secondary hover:text-green hover:bg-green/10"
          >
            {copied ? <Check className="text-green h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>

          {/* Save/Bookmark Button (Onoma Local Stash) */}
          {onSave && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleSave}
              disabled={localSaved || saving}
              title={localSaved ? "Saved to Local Stash" : "Save to Local Stash"}
              aria-label={localSaved ? "Saved to Local Stash" : "Save to Local Stash"}
              className={cn(
                localSaved
                  ? "bg-tint-fill text-tint"
                  : "text-label-secondary hover:bg-tint/10 hover:text-tint"
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bookmark className={cn("h-4 w-4", localSaved && "fill-tint text-tint")} />
              )}
            </Button>
          )}

          {/* Use/Redirect Button */}
          {onUse && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onUse(name);
              }}
              title="Deploy name in game"
              aria-label="Deploy name in game"
              className="text-label-secondary hover:text-yellow hover:bg-yellow/10"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          )}

          {/* Consumer-supplied actions (e.g. move-to-folder, delete) */}
          {headerExtras}
        </div>
      </div>

      {/* Per-name pronunciation editor (IPA + voice override) */}
      {editingPron && (
        <PronunciationEditor
          name={name}
          ipaDraft={ipaDraft}
          setIpaDraft={setIpaDraft}
          voiceDraft={voiceDraft}
          setVoiceDraft={setVoiceDraft}
          onSave={savePron}
          onCancel={() => setEditingPron(false)}
          onPreview={previewPron}
          onReset={resetPron}
        />
      )}

      {/* Expanded Inline Morph Area */}
      <AnimatePresence initial={false}>
        {showDetailsModal && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="overflow-hidden"
          >
            <LinguisticProfile
              name={name}
              morphology={morphology}
              savedAt={savedAt}
              originLabel={originLabel}
              localSaved={localSaved}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default NameResultCard;
