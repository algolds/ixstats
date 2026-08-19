"use client";

// src/app/labs/onoma/components/shared/NameResultCard.tsx
// Onoma Lab — Card component to display individual generated names

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  Bookmark,
  ArrowUpRight,
  Loader2,
  Volume2,
  Languages,
  Pencil,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { TextureOverlay } from "~/components/ui/texture-overlay";
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

interface NameResultCardProps {
  name: string;
  isSaved?: boolean;
  onSave?: (name: string, stashId?: string) => Promise<any> | void;
  onUse?: (name: string) => void;
  culture?: string;
  /** Phonotactic naturalness 0–100 vs the training set (Phase 5 perplexity scorer). */
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
          : "rose"
      : null;

  return (
    <FacetCard
      depth={showDetailsModal ? 2 : 1}
      onClick={expandOnCardClick ? () => setShowDetailsModal(!showDetailsModal) : undefined}
      className={cn(
        "group relative flex flex-col justify-start gap-3.5 overflow-hidden border px-4 py-4 transition-all duration-300 ease-out rounded-2xl",
        expandOnCardClick && "cursor-pointer select-none",
        // Default border/background colors matching the fit score
        fitColor === "emerald" && "border-emerald-500/20 bg-emerald-500/[0.015]",
        fitColor === "amber" && "border-amber-500/20 bg-amber-500/[0.015]",
        fitColor === "rose" && "border-rose-500/10 bg-rose-500/[0.01]",
        !fitColor && "border-border/40 bg-secondary/5",
        // Expanded details modal border styles
        showDetailsModal
          ? cn(
              "z-20 col-span-1 shadow-lg ring-1 sm:col-span-2",
              fitColor === "emerald" &&
                "border-emerald-500/35 shadow-emerald-500/5 ring-emerald-500/20",
              fitColor === "amber" && "border-amber-500/35 shadow-amber-500/5 ring-amber-500/20",
              fitColor === "rose" && "border-rose-500/25 shadow-rose-500/5 ring-rose-500/10",
              !fitColor &&
                "border-[#0091ff]/30 bg-[#0091ff]/[0.01] shadow-[#0091ff]/5 ring-[#0091ff]/10"
            )
          : cn(
              "z-10 col-span-1",
              fitColor === "emerald" &&
                "hover:border-emerald-500/45 hover:shadow-[0_0_14px_rgba(16,185,129,0.12)] dark:hover:border-emerald-500/35 dark:hover:shadow-[0_0_18px_rgba(16,185,129,0.18)]",
              fitColor === "amber" &&
                "hover:border-amber-500/45 hover:shadow-[0_0_14px_rgba(245,158,11,0.12)] dark:hover:border-amber-500/35 dark:hover:shadow-[0_0_18px_rgba(245,158,11,0.18)]",
              fitColor === "rose" &&
                "hover:border-rose-500/35 hover:shadow-[0_0_14px_rgba(244,63,94,0.1)] dark:hover:border-rose-500/25 dark:hover:shadow-[0_0_18px_rgba(244,63,94,0.15)]",
              !fitColor &&
                "hover:border-[#0091ff]/45 hover:shadow-[0_0_12px_rgba(0,145,255,0.08)] dark:hover:border-[#0091ff]/35 dark:hover:shadow-[0_0_16px_rgba(0,145,255,0.15)]"
            )
      )}
    >
      {/* Texture Overlay */}
      <div className="pointer-events-none absolute -inset-2 opacity-[0.08] transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:opacity-20 group-hover:blur-[1px] dark:opacity-45 dark:group-hover:opacity-85">
        <TextureOverlay texture="diamonds" className="mix-blend-overlay" />
      </div>

      {/* Refraction Radial Glows creeping from underneath all four corners */}
      {fitColor && (
        <>
          <div
            className={cn(
              "pointer-events-none absolute -top-10 -left-10 z-0 h-20 w-20 rounded-full blur-xl transition-all duration-700 ease-out",
              fitColor === "emerald" && "bg-emerald-500",
              fitColor === "amber" && "bg-amber-500",
              fitColor === "rose" && "bg-rose-500",
              "opacity-[0.04] group-hover:scale-125 group-hover:opacity-[0.15]"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute -top-10 -right-10 z-0 h-20 w-20 rounded-full blur-xl transition-all duration-700 ease-out",
              fitColor === "emerald" && "bg-emerald-500",
              fitColor === "amber" && "bg-amber-500",
              fitColor === "rose" && "bg-rose-500",
              "opacity-[0.04] group-hover:scale-125 group-hover:opacity-[0.15]"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute -bottom-10 -left-10 z-0 h-20 w-20 rounded-full blur-xl transition-all duration-700 ease-out",
              fitColor === "emerald" && "bg-emerald-500",
              fitColor === "amber" && "bg-amber-500",
              fitColor === "rose" && "bg-rose-500",
              "opacity-[0.04] group-hover:scale-125 group-hover:opacity-[0.15]"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute -right-10 -bottom-10 z-0 h-20 w-20 rounded-full blur-xl transition-all duration-700 ease-out",
              fitColor === "emerald" && "bg-emerald-500",
              fitColor === "amber" && "bg-amber-500",
              fitColor === "rose" && "bg-rose-500",
              "opacity-[0.04] group-hover:scale-125 group-hover:opacity-[0.15]"
            )}
          />
        </>
      )}

      {/* Main Top Row */}
      <div className="relative z-10 flex w-full min-w-0 items-start justify-between gap-3">
        {/* Name Display Stack */}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <span
            className="text-foreground w-full whitespace-nowrap font-bold tracking-tight leading-none transition-colors duration-300 group-hover:text-[#0091ff]"
            style={{ fontSize: dynamicFontSize }}
            title={name}
          >
            {name}
          </span>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
            {/* IPA badge — click to hear the exact phonetic pronunciation */}
            {ipa && (
              <span className="flex min-w-0 flex-shrink-0 items-center">
                <button
                  type="button"
                  onClick={handlePlayPronunciation}
                  title="Click to hear phonetic pronunciation"
                  className={cn(
                    "text-muted-foreground border-border/40 bg-secondary/15 flex cursor-pointer items-center gap-1 border py-0.5 pr-2.5 pl-2 font-mono text-[11px] tracking-[0.02em] whitespace-nowrap transition-all duration-200 select-none hover:bg-[#0091ff]/10 hover:text-[#0091ff] active:scale-[0.94]",
                    allowCustomize ? "rounded-l-full" : "rounded-full",
                    hasOverride && "border-[#0091ff]/40 text-[#0091ff]"
                  )}
                  style={dynamicIpaFontSize ? { fontSize: dynamicIpaFontSize } : undefined}
                >
                  <Volume2 className="h-3 w-3 flex-shrink-0 text-[#0091ff]" />
                  <span className="whitespace-nowrap">{ipa}</span>
                </button>
                {allowCustomize && (
                  <button
                    type="button"
                    onClick={openPronEditor}
                    title={hasOverride ? "Edit custom pronunciation" : "Customize IPA / voice"}
                    className={cn(
                      "text-muted-foreground border-border/40 bg-secondary/15 flex flex-shrink-0 cursor-pointer items-center rounded-r-full border border-l-0 px-1.5 py-0.5 transition-all duration-200 select-none hover:bg-[#0091ff]/10 hover:text-[#0091ff] active:scale-[0.94]"
                    )}
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={cn(
            "border-border/40 bg-background/90 flex flex-shrink-0 items-center gap-0.5 rounded-lg border px-1 py-0.5 shadow-sm backdrop-blur-md transition-all duration-200 ease-out select-none",
            showDetailsModal
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
          )}
        >
          {/* Linguistic Details Button (Toggles expand/shrink) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetailsModal(!showDetailsModal);
            }}
            title={showDetailsModal ? "Hide linguistic details" : "Show linguistic details"}
            className={cn(
              "cursor-pointer rounded-md p-1.5 transition-all duration-100 ease-out active:scale-[0.92]",
              showDetailsModal
                ? "bg-[#0091ff]/20 text-[#0091ff] shadow-[0_0_12px_rgba(0,145,255,0.25)] ring-1 ring-[#0091ff]/30"
                : "text-muted-foreground hover:bg-[#0091ff]/10 hover:text-[#0091ff]"
            )}
          >
            <Languages className="h-4 w-4" />
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title="Copy name to clipboard"
            className="text-muted-foreground cursor-pointer rounded-md p-1.5 transition-all duration-100 ease-out hover:bg-emerald-500/10 hover:text-emerald-600 active:scale-[0.92] dark:hover:text-emerald-400"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>

          {/* Save/Bookmark Button (Onoma Local Stash) */}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={localSaved || saving}
              title={localSaved ? "Saved to Local Stash" : "Save to Local Stash"}
              className={cn(
                "cursor-pointer rounded-md p-1.5 transition-all duration-100 ease-out active:scale-[0.92] disabled:opacity-50",
                localSaved
                  ? "scale-105 bg-[#0091ff]/20 text-[#0091ff] shadow-[0_0_12px_rgba(0,145,255,0.35)] ring-1 ring-[#0091ff]/30"
                  : "text-muted-foreground hover:bg-[#0091ff]/10 hover:text-[#0091ff]"
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bookmark
                  className={cn("h-4 w-4", localSaved && "fill-[#0091ff] text-[#0091ff]")}
                />
              )}
            </button>
          )}

          {/* Use/Redirect Button */}
          {onUse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUse(name);
              }}
              title="Deploy name in game"
              className="text-muted-foreground cursor-pointer rounded-md p-1.5 transition-all duration-100 ease-out hover:bg-amber-500/10 hover:text-amber-500 active:scale-[0.92]"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
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
    </FacetCard>
  );
}

export default NameResultCard;
