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
import type { MorphologyDetails } from "~/lib/onoma/morphology";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";

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
      className="border-separator animate-in fade-in slide-in-from-top-1 relative z-10 mt-3 w-full space-y-3 border-t pt-3 text-left duration-200"
    >
      {/* Header with Segmented Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-tint text-footnote font-mono font-semibold">⟨{name}⟩</span>
          <span className="text-label-secondary text-caption">
            Gender: <span className="text-label font-semibold">{morphology.gender}</span>
          </span>
        </div>

        <SegmentedControl
          size="sm"
          asTabs
          aria-label="Linguistic profile view"
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            {
              value: "declensions",
              label: "Declensions",
              badge: Object.keys(morphology.declensionTable).length,
              badgeLabel: `${Object.keys(morphology.declensionTable).length} forms`,
            },
            { value: "lexicon", label: `Lexicon${definition ? " ✓" : ""}` },
          ]}
        />
      </div>

      {/* Stash metadata — word kind + date stashed */}
      {(originLabel || savedAt) && (
        <div className="text-label-secondary text-caption flex flex-wrap items-center gap-2">
          {originLabel && (
            <span className="bg-tint/10 text-tint rounded-control-sm px-2 py-0.5 font-semibold capitalize">
              {originLabel}
            </span>
          )}
          {savedAt && (
            <span>
              Stashed{" "}
              <span className="text-label font-semibold">
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
        <div className="border-separator bg-surface rounded-row overflow-hidden border">
          <div className="bg-fill-4 border-separator text-label-secondary text-eyebrow grid grid-cols-12 border-b px-3 py-2 font-mono">
            <span className="col-span-4">Grammatical case</span>
            <span className="col-span-4">Singular</span>
            <span className="col-span-4">Plural</span>
          </div>

          <div className="divide-separator divide-y">
            {Object.entries(morphology.declensionTable).map(([caseName, declCase]) => (
              <div
                key={caseName}
                className="hover:bg-fill-4 text-footnote grid grid-cols-12 items-center px-3 py-2 transition-colors"
              >
                <div className="col-span-4 flex flex-col pr-1">
                  <span className="text-label text-caption font-semibold capitalize">
                    {caseName}
                  </span>
                  <span className="text-label-secondary text-caption leading-tight">
                    {declCase.descriptionSingular.split(" (")[0]}
                  </span>
                </div>
                <span className="text-tint text-footnote col-span-4 font-mono font-semibold break-all">
                  {declCase.singular}
                </span>
                <span className="text-tint text-footnote col-span-4 font-mono font-semibold break-all">
                  {declCase.plural}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Lexicon Dictionary Entry */}
      {activeTab === "lexicon" && (
        <div className="border-separator bg-surface rounded-row space-y-2 border p-4">
          <div className="border-separator flex items-center justify-between border-b pb-2">
            <h4 className="text-label text-subhead font-mono">Conlang lexicon entry</h4>
            {!isEditingDef && definition && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setIsEditingDef(true)}
                className="text-tint h-auto px-0"
              >
                Edit definition
              </Button>
            )}
          </div>

          {!localSaved ? (
            <p className="text-label-secondary text-caption leading-relaxed italic">
              Save this candidate to your Local Stash to customize its etymological root and
              meaning.
            </p>
          ) : isEditingDef || !definition ? (
            <form onSubmit={handleSaveDefinition} className="text-footnote space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-label-secondary text-subhead font-mono">
                    Part of speech
                  </label>
                  <Select value={editPos} onValueChange={setEditPos}>
                    <SelectTrigger className="text-footnote w-full">
                      <SelectValue placeholder="Select POS" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {["Noun", "Verb", "Adjective", "Adverb", "Root", "Proper Noun"].map((pos) => (
                        <SelectItem key={pos} value={pos} className="text-footnote">
                          {pos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-label-secondary text-subhead font-mono">
                    Conlang root
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. *ver- (water)"
                    value={editRoot}
                    onChange={(e) => setEditRoot(e.target.value)}
                    className="text-footnote w-full font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead font-mono">
                  Definition / Gloss
                </label>
                <Textarea
                  required
                  placeholder="Define semantic meaning..."
                  value={editMeaning}
                  onChange={(e) => setEditMeaning(e.target.value)}
                  className="text-footnote h-14 w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead font-mono">
                  Etymology / Origin
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Derived from archaic High Caphirian"
                  value={editOrigin}
                  onChange={(e) => setEditOrigin(e.target.value)}
                  className="text-footnote w-full"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {definition && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setIsEditingDef(false)}
                  >
                    Cancel
                  </Button>
                )}
                <Button size="sm" type="submit">
                  Save definition
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-footnote space-y-2">
              <div className="flex items-center justify-between">
                <span className="bg-tint/15 text-tint rounded-control-sm text-eyebrow px-2 py-0.5 font-mono">
                  {definition.partOfSpeech}
                </span>
                {definition.root && (
                  <span className="text-label-secondary text-caption font-mono">
                    Root: <span className="text-label font-semibold">{definition.root}</span>
                  </span>
                )}
              </div>
              <p className="text-label bg-fill-4 border-separator rounded-control text-footnote border p-3 leading-relaxed italic">
                "{definition.meaning}"
              </p>
              {definition.origin && (
                <p className="text-label-secondary text-caption leading-normal">
                  Origin: <span className="text-label font-medium">{definition.origin}</span>
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
