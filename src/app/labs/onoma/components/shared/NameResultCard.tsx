"use client";

// src/app/labs/onoma/components/shared/NameResultCard.tsx
// Onoma Lab — Card component to display individual generated names

import { useState, useEffect, useMemo } from "react";
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
import { PronunciationEditor } from "./PronunciationEditor";
import { LinguisticProfile } from "./LinguisticProfile";

interface NameResultCardProps {
  name: string;
  isSaved?: boolean;
  onSave?: (name: string, stashId?: string) => Promise<any>;
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

  const ipa = useMemo(() => {
    // SSR/first render: base translation (no localStorage) so markup matches the server.
    return mounted ? resolveIpa(name, culture ?? null) : translateToIPA(name, culture ?? null);
    // overridesVersion bumps when a localStorage override changes, forcing a re-resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, culture, mounted, overridesVersion]);

  const hasOverride = mounted ? Boolean(getNameOverride(name)) : false;

  const morphology = useMemo(() => {
    return getMorphologyDetails(name, culture ?? null);
  }, [name, culture]);

  // Shared playback: prefer Kokoro (phoneme mode from the resolved IPA), fall back to browser.
  //  - forceDefaultVoice → 🔊 reads exact phonemes in the configured default voice
  //  - voice / ipaText   → explicit overrides (used by the per-name editor preview)
  //  - otherwise          → per-name override → per-culture map → default (server resolves)
  const playName = (opts?: { forceDefaultVoice?: boolean; ipaText?: string; voice?: string }) =>
    speakName({
      name,
      ipa: opts?.ipaText ?? ipa,
      culture: culture ?? null,
      kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
      voice: opts?.voice ?? getNameOverride(name)?.voice,
      defaultVoice: speechConfig?.kokoro?.voice,
      forceDefaultVoice: opts?.forceDefaultVoice,
    });

  // 🔊 Pronounce — exact phonemes in the default voice.
  const handlePlayPronunciation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await playName({ forceDefaultVoice: true });
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
    if (len <= 12) return undefined;
    // Scale down linearly: 12 chars -> 16px, 30 chars -> 9.5px
    const sizePx = Math.max(9.5, 16 - (len - 12) * 0.36);
    return `${sizePx}px`;
  }, [name]);

  const dynamicIpaFontSize = useMemo(() => {
    if (!ipa) return undefined;
    const len = ipa.length;
    if (len <= 15) return undefined;
    // 15 chars -> 9px, 30 chars -> 7.5px
    const sizePx = Math.max(7.5, 9 - (len - 15) * 0.1);
    return `${sizePx}px`;
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
        "group relative flex flex-col justify-start gap-3.5 overflow-hidden border px-4 py-3.5 transition-all duration-500 ease-out",
        expandOnCardClick && "cursor-pointer select-none",
        // Default border/background colors matching the fit score
        fitColor === "emerald" && "border-emerald-500/20 bg-emerald-500/[0.01]",
        fitColor === "amber" && "border-amber-500/20 bg-amber-500/[0.01]",
        fitColor === "rose" && "border-rose-500/10 bg-rose-500/[0.005]",
        !fitColor && "border-border/40",
        // Expanded details modal border styles
        showDetailsModal
          ? cn(
              "z-20 col-span-1 shadow-lg ring-1 sm:col-span-2",
              fitColor === "emerald" && "border-emerald-500/35 ring-emerald-500/20 shadow-emerald-500/5",
              fitColor === "amber" && "border-amber-500/35 ring-amber-500/20 shadow-amber-500/5",
              fitColor === "rose" && "border-rose-500/25 ring-rose-500/10 shadow-rose-500/5",
              !fitColor && "border-[#0091ff]/30 bg-[#0091ff]/[0.01] shadow-[#0091ff]/5 ring-[#0091ff]/10"
            )
          : cn(
              "z-10 col-span-1",
              fitColor === "emerald" && "hover:border-emerald-500/45 hover:shadow-[0_0_14px_rgba(16,185,129,0.12)] dark:hover:border-emerald-500/35 dark:hover:shadow-[0_0_18px_rgba(16,185,129,0.18)]",
              fitColor === "amber" && "hover:border-amber-500/45 hover:shadow-[0_0_14px_rgba(245,158,11,0.12)] dark:hover:border-amber-500/35 dark:hover:shadow-[0_0_18px_rgba(245,158,11,0.18)]",
              fitColor === "rose" && "hover:border-rose-500/35 hover:shadow-[0_0_14px_rgba(244,63,94,0.1)] dark:hover:border-rose-500/25 dark:hover:shadow-[0_0_18px_rgba(244,63,94,0.15)]",
              !fitColor && "hover:border-[#0091ff]/45 hover:shadow-[0_0_12px_rgba(0,145,255,0.08)] dark:hover:border-[#0091ff]/35 dark:hover:shadow-[0_0_16px_rgba(0,145,255,0.15)]"
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
              "pointer-events-none absolute -left-10 -top-10 h-20 w-20 rounded-full blur-xl transition-all duration-700 ease-out z-0",
              fitColor === "emerald" && "bg-emerald-500",
              fitColor === "amber" && "bg-amber-500",
              fitColor === "rose" && "bg-rose-500",
              "opacity-[0.04] group-hover:opacity-[0.15] group-hover:scale-125"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute -right-10 -top-10 h-20 w-20 rounded-full blur-xl transition-all duration-700 ease-out z-0",
              fitColor === "emerald" && "bg-emerald-500",
              fitColor === "amber" && "bg-amber-500",
              fitColor === "rose" && "bg-rose-500",
              "opacity-[0.04] group-hover:opacity-[0.15] group-hover:scale-125"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute -left-10 -bottom-10 h-20 w-20 rounded-full blur-xl transition-all duration-700 ease-out z-0",
              fitColor === "emerald" && "bg-emerald-500",
              fitColor === "amber" && "bg-amber-500",
              fitColor === "rose" && "bg-rose-500",
              "opacity-[0.04] group-hover:opacity-[0.15] group-hover:scale-125"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute -right-10 -bottom-10 h-20 w-20 rounded-full blur-xl transition-all duration-700 ease-out z-0",
              fitColor === "emerald" && "bg-emerald-500",
              fitColor === "amber" && "bg-amber-500",
              fitColor === "rose" && "bg-rose-500",
              "opacity-[0.04] group-hover:opacity-[0.15] group-hover:scale-125"
            )}
          />
        </>
      )}

      {/* Main Top Row */}
      <div className="relative z-10 flex w-full items-center justify-between gap-3 min-w-0">
        {/* Name Display Stack */}
        <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
          <span
            className="text-foreground text-sm font-semibold tracking-wide transition-colors duration-300 group-hover:text-[#0091ff] sm:text-base whitespace-nowrap truncate w-full"
            style={dynamicFontSize ? { fontSize: dynamicFontSize } : undefined}
            title={name}
          >
            {name}
          </span>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 min-w-0 w-full">
            {/* IPA badge — click to hear the exact phonetic pronunciation */}
            {ipa && (
              <span className="flex items-center min-w-0 flex-shrink-0">
                <button
                  type="button"
                  onClick={handlePlayPronunciation}
                  title="Click to hear the exact phonetic pronunciation"
                  className={cn(
                    "text-muted-foreground border-border/40 bg-secondary/5 flex cursor-pointer items-center gap-1 border py-0.5 pr-2 pl-2 font-mono text-[9px] transition-all duration-200 select-none hover:bg-[#0091ff]/10 hover:text-[#0091ff] whitespace-nowrap",
                    allowCustomize ? "rounded-l-full" : "rounded-full",
                    hasOverride && "border-[#0091ff]/40 text-[#0091ff]"
                  )}
                  style={dynamicIpaFontSize ? { fontSize: dynamicIpaFontSize } : undefined}
                >
                  <Volume2 className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">{ipa}</span>
                </button>
                {allowCustomize && (
                  <button
                    type="button"
                    onClick={openPronEditor}
                    title={hasOverride ? "Edit custom pronunciation" : "Customize IPA / voice"}
                    className={cn(
                      "text-muted-foreground border-border/40 bg-secondary/5 flex cursor-pointer items-center rounded-r-full border border-l-0 px-1.5 py-0.5 transition-all duration-200 select-none hover:bg-[#0091ff]/10 hover:text-[#0091ff] flex-shrink-0"
                    )}
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons (Fades in on hover, but occupies fixed space in flex row) */}
        <div
          className={cn(
            "flex flex-shrink-0 items-center gap-1 rounded-lg border border-border/40 bg-background/85 px-1.5 py-1 shadow-lg backdrop-blur-md transition-all duration-300 ease-out select-none",
            showDetailsModal
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
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
              "cursor-pointer rounded-md p-1.5 transition-all duration-200 active:scale-90",
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
            className="text-muted-foreground cursor-pointer rounded-md p-1.5 transition-all duration-200 hover:bg-emerald-500/10 hover:text-emerald-600 active:scale-90 dark:hover:text-emerald-400"
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
                "cursor-pointer rounded-md p-1.5 transition-all duration-200 active:scale-90 disabled:opacity-50",
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
              className="text-muted-foreground cursor-pointer rounded-md p-1.5 transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500 active:scale-90"
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
      {showDetailsModal && (
        <LinguisticProfile
          name={name}
          morphology={morphology}
          savedAt={savedAt}
          originLabel={originLabel}
          localSaved={localSaved}
        />
      )}
    </FacetCard>
  );
}

export default NameResultCard;
