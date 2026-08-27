"use client";

// src/app/labs/onoma/components/shared/LinguisticProfile.tsx
// Onoma Custom Studio Workshop — Linguistic Profile Details Component

import { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import type { MorphologyDetails } from "~/lib/onoma/morphology";

interface LinguisticProfileProps {
  name: string;
  morphology:
    | MorphologyDetails
    | {
        gender: string;
        declensionTable: Record<
          string,
          {
            singular: string;
            plural: string;
            descriptionSingular: string;
            descriptionPlural: string;
          }
        >;
      };
  savedAt?: Date | string | null;
  originLabel?: string | null;
  localSaved: boolean;
}

export function LinguisticProfile({
  name,
  morphology,
  savedAt,
  originLabel,
  localSaved,
}: LinguisticProfileProps) {
  // Lexicon Definitions State
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

  const loadDefinition = useCallback(() => {
    if (typeof window !== "undefined") {
      const defsJson = localStorage.getItem("onoma-lexicon-definitions");
      if (defsJson) {
        const defs = JSON.parse(defsJson);
        const def = defs[name];
        setDefinition(def || null);
        if (def) {
          setEditPos(def.partOfSpeech || "Noun");
          setEditRoot(def.root || "");
          setEditMeaning(def.meaning || "");
          setEditOrigin(def.origin || "");
        }
      }
    }
  }, [name]);

  // Sync lexicon from localStorage + custom event — external system, setState in effect is intentional
  // oxlint-disable-next-line
  useEffect(() => {
    loadDefinition();
    window.addEventListener("onoma-definitions-updated", loadDefinition);
    return () => {
      window.removeEventListener("onoma-definitions-updated", loadDefinition);
    };
  }, [loadDefinition]);

  const handleSaveDefinition = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window === "undefined") return;

    const defsJson = localStorage.getItem("onoma-lexicon-definitions") || "{}";
    const defs = JSON.parse(defsJson);
    const newDef = {
      partOfSpeech: editPos,
      root: editRoot.trim(),
      meaning: editMeaning.trim(),
      origin: editOrigin.trim(),
    };
    defs[name] = newDef;
    localStorage.setItem("onoma-lexicon-definitions", JSON.stringify(defs));
    setDefinition(newDef);
    setIsEditingDef(false);

    // Alert other panels
    window.dispatchEvent(new Event("onoma-definitions-updated"));
  };

  const [activeTab, setActiveTab] = useState<"declensions" | "lexicon">("declensions");

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="border-border/30 animate-in fade-in slide-in-from-top-1 relative z-10 mt-3 w-full space-y-3 border-t pt-3 text-left duration-200"
    >
      {/* Header with Segmented Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-onoma-primary font-mono text-xs font-bold">⟨{name}⟩</span>
          <span className="text-muted-foreground text-[11px]">
            Gender:{" "}
            <span className="text-foreground font-semibold uppercase">{morphology.gender}</span>
          </span>
        </div>

        {/* Apple Segmented Switcher */}
        <div className="border-border/50 bg-secondary/30 flex items-center rounded-lg border p-0.5 select-none">
          <button
            type="button"
            onClick={() => setActiveTab("declensions")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-0.5 font-mono text-[10px] font-semibold transition-all",
              activeTab === "declensions"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Declensions ({Object.keys(morphology.declensionTable).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lexicon")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-0.5 font-mono text-[10px] font-semibold transition-all",
              activeTab === "lexicon"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Lexicon {definition ? "✓" : ""}
          </button>
        </div>
      </div>

      {/* Stash metadata — word kind + date stashed */}
      {(originLabel || savedAt) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[10px]">
          {originLabel && (
            <span className="bg-onoma-primary/10 text-onoma-primary rounded px-1.5 py-0.5 font-bold capitalize">
              {originLabel}
            </span>
          )}
          {savedAt && (
            <span>
              Stashed{" "}
              <span className="text-foreground font-semibold">
                {new Date(savedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Tab 1: Case Declension Table */}
      {activeTab === "declensions" && (
        <div className="border-border/30 bg-background/80 overflow-hidden rounded-xl border">
          <div className="bg-secondary/20 border-border/30 text-muted-foreground grid grid-cols-12 border-b px-3 py-1.5 font-mono text-[9px] font-bold tracking-wider uppercase">
            <span className="col-span-4">Grammatical Case</span>
            <span className="col-span-4">Singular</span>
            <span className="col-span-4">Plural</span>
          </div>

          <div className="divide-border/15 divide-y">
            {Object.entries(morphology.declensionTable).map(([caseName, declCase]) => (
              <div
                key={caseName}
                className="hover:bg-secondary/10 grid grid-cols-12 items-center px-3 py-1.5 text-xs transition-colors"
              >
                <div className="col-span-4 flex flex-col pr-1">
                  <span className="text-foreground text-[11px] font-semibold capitalize">
                    {caseName}
                  </span>
                  <span className="text-muted-foreground text-[9px] leading-tight">
                    {declCase.descriptionSingular.split(" (")[0]}
                  </span>
                </div>
                <span className="text-onoma-primary col-span-4 font-mono text-xs font-semibold break-all">
                  {declCase.singular}
                </span>
                <span className="text-onoma-primary col-span-4 font-mono text-xs font-semibold break-all">
                  {declCase.plural}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Lexicon Dictionary Entry */}
      {activeTab === "lexicon" && (
        <div className="border-border/30 bg-background/80 space-y-2.5 rounded-xl border p-3.5">
          <div className="border-border/20 flex items-center justify-between border-b pb-2">
            <h4 className="text-foreground font-mono text-[10px] font-bold tracking-wider uppercase">
              Conlang Lexicon Entry
            </h4>
            {!isEditingDef && definition && (
              <button
                onClick={() => setIsEditingDef(true)}
                className="text-onoma-primary cursor-pointer text-[10px] font-semibold hover:underline"
              >
                Edit Definition
              </button>
            )}
          </div>

          {!localSaved ? (
            <p className="text-muted-foreground text-[11px] leading-relaxed italic">
              Save this candidate to your Local Stash to customize its etymological root and
              meaning.
            </p>
          ) : isEditingDef || !definition ? (
            <form onSubmit={handleSaveDefinition} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-muted-foreground font-mono text-[9px] font-bold uppercase">
                    Part of Speech
                  </label>
                  <Select value={editPos} onValueChange={setEditPos}>
                    <SelectTrigger className="border-border/60 bg-background hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2.5 py-1 text-xs transition-colors focus:outline-none">
                      <SelectValue placeholder="Select POS" />
                    </SelectTrigger>
                    <SelectContent className="border-border/40 bg-popover/95 max-h-[200px] backdrop-blur-xl">
                      {["Noun", "Verb", "Adjective", "Adverb", "Root", "Proper Noun"].map((pos) => (
                        <SelectItem
                          key={pos}
                          value={pos}
                          className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
                        >
                          {pos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-muted-foreground font-mono text-[9px] font-bold uppercase">
                    Conlang Root
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. *ver- (water)"
                    value={editRoot}
                    onChange={(e) => setEditRoot(e.target.value)}
                    className="border-border/60 bg-background text-foreground focus:border-onoma-primary/60 w-full rounded-lg border px-2.5 py-1 font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground font-mono text-[9px] font-bold uppercase">
                  Definition / Gloss
                </label>
                <textarea
                  required
                  placeholder="Define semantic meaning..."
                  value={editMeaning}
                  onChange={(e) => setEditMeaning(e.target.value)}
                  className="border-border/60 bg-background text-foreground focus:border-onoma-primary/60 h-14 w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground font-mono text-[9px] font-bold uppercase">
                  Etymology / Origin
                </label>
                <input
                  type="text"
                  placeholder="e.g. Derived from archaic High Caphirian"
                  value={editOrigin}
                  onChange={(e) => setEditOrigin(e.target.value)}
                  className="border-border/60 bg-background text-foreground focus:border-onoma-primary/60 w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {definition && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDef(false)}
                    className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-onoma-primary hover:bg-onoma-primary-light rounded-lg px-3 py-1 text-xs font-bold text-white transition-colors"
                >
                  Save Definition
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="bg-onoma-primary/15 text-onoma-primary rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                  {definition.partOfSpeech}
                </span>
                {definition.root && (
                  <span className="text-muted-foreground font-mono text-[10px]">
                    Root: <span className="text-foreground font-semibold">{definition.root}</span>
                  </span>
                )}
              </div>
              <p className="text-foreground bg-secondary/15 border-border/20 rounded-lg border p-2.5 text-xs leading-relaxed italic">
                "{definition.meaning}"
              </p>
              {definition.origin && (
                <p className="text-muted-foreground text-[10px] leading-normal">
                  Origin: <span className="text-foreground font-medium">{definition.origin}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LinguisticProfile;
