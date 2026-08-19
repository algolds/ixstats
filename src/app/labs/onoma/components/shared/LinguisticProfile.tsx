"use client";

// src/app/labs/onoma/components/shared/LinguisticProfile.tsx
// Onoma Custom Studio Workshop — Linguistic Profile Details Component

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { MorphologyDetails } from "~/lib/onoma/morphology";

interface LinguisticProfileProps {
  name: string;
  morphology: MorphologyDetails | {
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

  const loadDefinition = () => {
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
  };

  useEffect(() => {
    loadDefinition();
    window.addEventListener("onoma-definitions-updated", loadDefinition);
    return () => {
      window.removeEventListener("onoma-definitions-updated", loadDefinition);
    };
  }, [name]);

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

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="border-border/20 animate-in slide-in-from-top-2 relative z-10 mt-1 w-full space-y-4 border-t pt-3 text-left duration-300"
    >
      <div className="border-border/10 flex items-center justify-between border-b pb-2">
        <h3 className="text-foreground flex items-center gap-2 text-xs font-bold">
          <span>Linguistic Profile:</span>
          <span className="font-mono text-[#0091ff]">{name}</span>
        </h3>
        <p className="text-muted-foreground text-[10px] font-semibold">
          Grammatical Gender:{" "}
          <span className="font-bold text-[#0091ff] uppercase">{morphology.gender}</span>
        </p>
      </div>

      {/* Stash metadata — word kind + date stashed */}
      {(originLabel || savedAt) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[10px]">
          {originLabel && (
            <span className="rounded bg-[#0091ff]/10 px-1.5 py-0.5 font-bold text-[#0091ff] capitalize">
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

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Case Declension Table */}
        <div className="border-border/40 bg-background overflow-hidden rounded-xl border">
          <div className="bg-secondary/10 border-border/40 text-muted-foreground grid grid-cols-3 border-b px-3 py-2 text-[10px] font-bold tracking-wider uppercase">
            <span>Case</span>
            <span>Singular</span>
            <span>Plural</span>
          </div>

          <div className="divide-border/20 divide-y text-xs">
            {Object.entries(morphology.declensionTable).map(([caseName, declCase]) => (
              <div key={caseName} className="grid grid-cols-3 items-center px-3 py-2">
                <div className="flex flex-col pr-1">
                  <span className="text-foreground text-[10px] font-bold capitalize">
                    {caseName}
                  </span>
                  <span className="text-muted-foreground mt-0.5 text-[8px] leading-normal">
                    {declCase.descriptionSingular.split(" (")[0]}
                  </span>
                </div>
                <span className="truncate font-mono text-[10px] font-semibold text-[#0091ff]">
                  {declCase.singular}
                </span>
                <span className="truncate font-mono text-[10px] font-semibold text-[#0091ff]">
                  {declCase.plural}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Lexicon Dictionary Entry */}
        <div className="border-border/40 bg-background space-y-2.5 rounded-xl border p-3">
          <div className="border-border/20 flex items-center justify-between border-b pb-1.5">
            <h4 className="text-foreground text-[10px] font-bold tracking-wider uppercase">
              Conlang Lexicon Entry
            </h4>
            {!isEditingDef && definition && (
              <button
                onClick={() => setIsEditingDef(true)}
                className="cursor-pointer text-[9px] font-bold text-[#0091ff] hover:underline"
              >
                Edit Definition
              </button>
            )}
          </div>

          {!localSaved ? (
            <p className="text-muted-foreground text-[10px] leading-normal italic">
              Save this name to your Local Stash to define its root and meaning.
            </p>
          ) : isEditingDef || !definition ? (
            <form onSubmit={handleSaveDefinition} className="space-y-2 text-[10px]">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-muted-foreground text-[8px] font-bold uppercase">
                    Part of Speech
                  </label>
                  <Select value={editPos} onValueChange={setEditPos}>
                    <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2 py-0.5 text-xs transition-colors focus:outline-none">
                      <SelectValue placeholder="Select POS" />
                    </SelectTrigger>
                    <SelectContent className="border-border/40 bg-background/95 max-h-[200px] backdrop-blur-md">
                      <SelectItem
                        value="Noun"
                        className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                      >
                        Noun
                      </SelectItem>
                      <SelectItem
                        value="Verb"
                        className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                      >
                        Verb
                      </SelectItem>
                      <SelectItem
                        value="Adjective"
                        className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                      >
                        Adjective
                      </SelectItem>
                      <SelectItem
                        value="Adverb"
                        className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                      >
                        Adverb
                      </SelectItem>
                      <SelectItem
                        value="Root"
                        className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                      >
                        Root
                      </SelectItem>
                      <SelectItem
                        value="Proper Noun"
                        className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                      >
                        Proper Noun
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-muted-foreground text-[8px] font-bold uppercase">
                    Conlang Root
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ver- (water)"
                    value={editRoot}
                    onChange={(e) => setEditRoot(e.target.value)}
                    className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2 py-0.5 text-xs focus:outline-none"
                  />
                </div>
              </div>
              <div className="space-y-0.5">
                <label className="text-muted-foreground text-[8px] font-bold uppercase">
                  Definition / Meaning
                </label>
                <textarea
                  required
                  placeholder="Define the term..."
                  value={editMeaning}
                  onChange={(e) => setEditMeaning(e.target.value)}
                  className="border-border/60 bg-background text-foreground h-10 w-full rounded-lg border px-2 py-1 text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-muted-foreground text-[8px] font-bold uppercase">
                  Etymology / Origin
                </label>
                <input
                  type="text"
                  placeholder="e.g. Derived from ancient caphirian base"
                  value={editOrigin}
                  onChange={(e) => setEditOrigin(e.target.value)}
                  className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2 py-0.5 text-xs focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-0.5">
                {definition && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDef(false)}
                    className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 rounded border px-2 py-0.5 text-[9px] font-bold transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded bg-[#0091ff] px-2.5 py-0.5 text-[9px] font-bold text-white transition-colors hover:bg-[#33a7ff]"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-1.5 text-[10px]">
              <div className="flex justify-between">
                <span className="py-0.2 rounded bg-[#0091ff]/10 px-1.5 text-[9px] font-bold text-[#0091ff] uppercase">
                  {definition.partOfSpeech}
                </span>
                {definition.root && (
                  <span className="text-muted-foreground font-mono text-[9px]">
                    Root: {definition.root}
                  </span>
                )}
              </div>
              <p className="text-foreground bg-secondary/5 border-border/20 rounded-lg border p-2 text-xs italic">
                "{definition.meaning}"
              </p>
              {definition.origin && (
                <p className="text-muted-foreground text-[9px] leading-normal">
                  Origin: {definition.origin}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LinguisticProfile;
