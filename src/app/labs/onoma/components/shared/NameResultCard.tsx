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
} from "lucide-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { translateToIPA } from "~/lib/onoma/phonology";
import { getMorphologyDetails } from "~/lib/onoma/morphology";

interface NameResultCardProps {
  name: string;
  isSaved?: boolean;
  onSave?: (name: string, stashId?: string) => Promise<any>;
  onUse?: (name: string) => void;
  culture?: string;
}

export function NameResultCard({ name, isSaved = false, onSave, onUse, culture }: NameResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localSaved, setLocalSaved] = useState(isSaved);

  // const [copiedTextType, setCopiedTextType] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [definition, setDefinition] = useState<{
    partOfSpeech: string;
    root: string;
    meaning: string;
    origin: string;
  } | null>(null);
  const [isEditingDef, setIsEditingDef] = useState(false);
  const [editPos, setEditPos] = useState("Noun");
  const [editRoot, setEditRoot] = useState("");
  const [editMeaning, setEditMeaning] = useState("");
  const [editOrigin, setEditOrigin] = useState("");

  const ipa = useMemo(() => {
    return translateToIPA(name, culture ?? null);
  }, [name, culture]);

  // const cyrillicScript = useMemo(() => transcribeToScript(name, "cyrillic"), [name]);
  // const greekScript = useMemo(() => transcribeToScript(name, "greek"), [name]);
  // const arabicScript = useMemo(() => transcribeToScript(name, "arabic"), [name]);

  const morphology = useMemo(() => {
    return getMorphologyDetails(name, culture ?? null);
  }, [name, culture]);

  // const handleCopyText = async (text: string, type: string) => {
  //   try {
  //     await navigator.clipboard.writeText(text);
  //     setCopiedTextType(type);
  //     setTimeout(() => setCopiedTextType(null), 2000);
  //   } catch (err) {
  //     console.error("Failed to copy script text:", err);
  //   }
  // };

  useEffect(() => {
    if (showDetailsModal && typeof window !== "undefined") {
      const defsJson = localStorage.getItem("onoma-lexicon-definitions");
      if (defsJson) {
        const defs = JSON.parse(defsJson);
        const def = defs[name] || null;
        setDefinition(def);
        if (def) {
          setEditPos(def.partOfSpeech || "Noun");
          setEditRoot(def.root || "");
          setEditMeaning(def.meaning || "");
          setEditOrigin(def.origin || "");
        } else {
          setEditPos("Noun");
          setEditRoot("");
          setEditMeaning("");
          setEditOrigin("");
        }
      }
    }
  }, [showDetailsModal, name]);

  const handleSaveDefinition = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window === "undefined") return;
    const defsJson = localStorage.getItem("onoma-lexicon-definitions") || "{}";
    const defs = JSON.parse(defsJson);
    const newDef = {
      partOfSpeech: editPos,
      root: editRoot,
      meaning: editMeaning,
      origin: editOrigin,
    };
    defs[name] = newDef;
    localStorage.setItem("onoma-lexicon-definitions", JSON.stringify(defs));
    setDefinition(newDef);
    setIsEditingDef(false);
    
    // Dispatch custom event to notify other subcomponents of updates
    window.dispatchEvent(new Event("onoma-definitions-updated"));
  };

  const handlePlayPronunciation = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(name);
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Sync prop changes to local state
  useEffect(() => {
    setLocalSaved(isSaved);
  }, [isSaved]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleSave = async () => {
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

  return (
    <FacetCard
      depth={showDetailsModal ? 2 : 1}
      className={cn(
        "group border-border/40 relative flex flex-col justify-start overflow-hidden border px-4 py-3.5 transition-all duration-300 ease-in-out gap-3.5",
        showDetailsModal
          ? "col-span-1 sm:col-span-2 z-20 border-[#0091ff]/30 bg-[#0091ff]/[0.01] shadow-lg ring-1 shadow-[#0091ff]/5 ring-[#0091ff]/10"
          : "col-span-1 z-10 hover:border-[#0091ff]/45 hover:shadow-[0_0_12px_rgba(0,145,255,0.08)] dark:hover:border-[#0091ff]/35 dark:hover:shadow-[0_0_16px_rgba(0,145,255,0.15)]"
      )}
    >
      {/* Texture Overlay */}
      <div className="pointer-events-none absolute -inset-2 opacity-[0.08] transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:opacity-20 group-hover:blur-[1px] dark:opacity-45 dark:group-hover:opacity-85">
        <TextureOverlay texture="diamonds" className="mix-blend-overlay" />
      </div>

      {/* Main Top Row */}
      <div className="flex items-center justify-between w-full relative z-10 gap-3">
        {/* Name Display */}
        <div className="flex flex-col items-start gap-1">
          <span className="text-foreground text-sm font-semibold tracking-wide transition-colors duration-300 group-hover:text-[#0091ff] sm:text-base">
            {name}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {ipa && (
              <button
                onClick={handlePlayPronunciation}
                title="Listen to pronunciation"
                className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-[#0091ff] hover:bg-[#0091ff]/10 border border-border/40 bg-secondary/5 px-2 py-0.5 rounded-full transition-all duration-200 cursor-pointer font-mono select-none"
              >
                <Volume2 className="h-2.5 w-2.5" />
                <span>{ipa}</span>
              </button>
            )}
            {/* Hidden for now: Cyrillic/Greek/Arabic spelling buttons */}
            {/*
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyText(cyrillicScript, "Cyrillic");
              }}
              title="Copy Cyrillic spelling"
              className="text-[9px] text-muted-foreground hover:text-[#0091ff] hover:bg-[#0091ff]/10 border border-border/40 bg-secondary/5 px-2 py-0.5 rounded-full transition-all duration-200 cursor-pointer font-sans select-none"
            >
              <span>{copiedTextType === "Cyrillic" ? "Copied!" : `Cyrillic: ${cyrillicScript}`}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyText(greekScript, "Greek");
              }}
              title="Copy Greek spelling"
              className="text-[9px] text-muted-foreground hover:text-[#0091ff] hover:bg-[#0091ff]/10 border border-border/40 bg-secondary/5 px-2 py-0.5 rounded-full transition-all duration-200 cursor-pointer font-sans select-none"
            >
              <span>{copiedTextType === "Greek" ? "Copied!" : `Greek: ${greekScript}`}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyText(arabicScript, "Arabic");
              }}
              title="Copy Arabic spelling"
              className="text-[9px] text-muted-foreground hover:text-[#0091ff] hover:bg-[#0091ff]/10 border border-border/40 bg-secondary/5 px-2 py-0.5 rounded-full transition-all duration-200 cursor-pointer font-sans select-none"
              dir="rtl"
            >
              <span>{copiedTextType === "Arabic" ? "Copied!" : arabicScript}</span>
            </button>
            */}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={cn(
            "relative z-10 flex items-center gap-1.5 transition-opacity duration-300",
            showDetailsModal ? "opacity-100" : "opacity-60 group-hover:opacity-100"
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
              "rounded-md p-1.5 transition-all duration-200 active:scale-90 cursor-pointer",
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
            className="text-muted-foreground rounded-md p-1.5 transition-all duration-200 hover:bg-emerald-500/10 hover:text-emerald-600 active:scale-90 dark:hover:text-emerald-400 cursor-pointer"
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
                "rounded-md p-1.5 transition-all duration-200 active:scale-90 disabled:opacity-50 cursor-pointer",
                localSaved
                  ? "scale-105 bg-[#0091ff]/20 text-[#0091ff] shadow-[0_0_12px_rgba(0,145,255,0.35)] ring-1 ring-[#0091ff]/30"
                  : "text-muted-foreground hover:bg-[#0091ff]/10 hover:text-[#0091ff]"
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bookmark className={cn("h-4 w-4", localSaved && "fill-[#0091ff] text-[#0091ff]")} />
              )}
            </button>
          )}

          {/* Use/Redirect Button */}
          {onUse && (
            <button
              onClick={() => onUse(name)}
              title="Deploy name in game"
              className="text-muted-foreground rounded-md p-1.5 transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500 active:scale-90 cursor-pointer"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Inline Morph Area */}
      {showDetailsModal && (
        <div className="w-full border-t border-border/20 pt-3 mt-1 space-y-4 animate-in slide-in-from-top-2 duration-300 relative z-10 text-left">
          <div className="flex justify-between items-center border-b border-border/10 pb-2">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <span>Linguistic Profile:</span>
              <span className="text-[#0091ff] font-mono">{name}</span>
            </h3>
            <p className="text-[10px] text-muted-foreground font-semibold">
              Grammatical Gender: <span className="text-[#0091ff] font-bold uppercase">{morphology.gender}</span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Case Declension Table */}
            <div className="border border-border/40 rounded-xl overflow-hidden bg-background">
              <div className="grid grid-cols-3 bg-secondary/10 px-3 py-2 text-[10px] font-bold border-b border-border/40 text-muted-foreground uppercase tracking-wider">
                <span>Case</span>
                <span>Singular</span>
                <span>Plural</span>
              </div>
              
              <div className="divide-y divide-border/20 text-xs">
                {Object.entries(morphology.declensionTable).map(([caseName, declCase]) => (
                  <div key={caseName} className="grid grid-cols-3 px-3 py-2 items-center">
                    <div className="flex flex-col pr-1">
                      <span className="font-bold text-foreground capitalize text-[10px]">{caseName}</span>
                      <span className="text-[8px] text-muted-foreground leading-normal mt-0.5">
                        {declCase.descriptionSingular.split(" (")[0]}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-[#0091ff] truncate text-[10px]">{declCase.singular}</span>
                    <span className="font-mono font-semibold text-[#0091ff] truncate text-[10px]">{declCase.plural}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lexicon Dictionary Entry */}
            <div className="border border-border/40 rounded-xl p-3 bg-background space-y-2.5">
              <div className="flex justify-between items-center border-b border-border/20 pb-1.5">
                <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Conlang Lexicon Entry</h4>
                {!isEditingDef && definition && (
                  <button
                    onClick={() => setIsEditingDef(true)}
                    className="text-[9px] font-bold text-[#0091ff] hover:underline cursor-pointer"
                  >
                    Edit Definition
                  </button>
                )}
              </div>

              {!localSaved ? (
                <p className="text-[10px] text-muted-foreground italic leading-normal">
                  Save this name to your Local Stash to define its root and meaning.
                </p>
              ) : isEditingDef || !definition ? (
                <form onSubmit={handleSaveDefinition} className="space-y-2 text-[10px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-bold text-muted-foreground uppercase">Part of Speech</label>
                      <select
                        value={editPos}
                        onChange={(e) => setEditPos(e.target.value)}
                        className="w-full rounded-lg border border-border/60 bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none"
                      >
                        <option value="Noun">Noun</option>
                        <option value="Verb">Verb</option>
                        <option value="Adjective">Adjective</option>
                        <option value="Adverb">Adverb</option>
                        <option value="Root">Root</option>
                        <option value="Proper Noun">Proper Noun</option>
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-bold text-muted-foreground uppercase">Conlang Root</label>
                      <input
                        type="text"
                        placeholder="e.g. ver- (water)"
                        value={editRoot}
                        onChange={(e) => setEditRoot(e.target.value)}
                        className="w-full rounded-lg border border-border/60 bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-muted-foreground uppercase">Definition / Meaning</label>
                    <textarea
                      required
                      placeholder="Define the term..."
                      value={editMeaning}
                      onChange={(e) => setEditMeaning(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-muted-foreground uppercase">Etymology / Origin</label>
                    <input
                      type="text"
                      placeholder="e.g. Derived from ancient caphirian base"
                      value={editOrigin}
                      onChange={(e) => setEditOrigin(e.target.value)}
                      className="w-full rounded-lg border border-border/60 bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5 pt-0.5">
                    {definition && (
                      <button
                        type="button"
                        onClick={() => setIsEditingDef(false)}
                        className="rounded border border-border/60 bg-background px-2 py-0.5 text-[9px] font-bold text-muted-foreground hover:bg-secondary/40 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="rounded bg-[#0091ff] hover:bg-[#33a7ff] px-2.5 py-0.5 text-[9px] font-bold text-white transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-[9px] bg-[#0091ff]/10 text-[#0091ff] px-1.5 py-0.2 rounded font-bold uppercase">
                      {definition.partOfSpeech}
                    </span>
                    {definition.root && (
                      <span className="text-muted-foreground font-mono text-[9px]">
                        Root: {definition.root}
                      </span>
                    )}
                  </div>
                  <p className="text-foreground italic bg-secondary/5 border border-border/20 rounded-lg p-2 text-xs">
                    "{definition.meaning}"
                  </p>
                  {definition.origin && (
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Origin: {definition.origin}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </FacetCard>
  );
}

export default NameResultCard;
