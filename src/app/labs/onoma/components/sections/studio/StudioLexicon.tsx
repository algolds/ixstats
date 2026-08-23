"use client";

import { useState, useEffect } from "react";
import { OpenBook as BookOpen, Search, SoundHigh as Volume2, Trash as Trash2, EditPencil as Pencil, Xmark as X, Undo as RotateCcw } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { type StudioState } from "../../../hooks/useStudioState";
import { api } from "~/trpc/react";
import { speakName } from "~/lib/onoma/browser-speech";
import { getNameOverride, setNameOverride } from "~/lib/onoma/ipa-overrides";
import { useNotify } from "~/hooks/useNotify";
import { ipaToKokoroPhonemes } from "~/lib/onoma/kokoro-phonemes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { LexiconAnalysis } from "./LexiconAnalysis";
import { LexiconDefinitionForm } from "./LexiconDefinitionForm";

interface StudioLexiconProps {
  state: StudioState;
}

export function StudioLexicon({ state }: StudioLexiconProps) {
  const notify = useNotify();

  // Load public speech config (including Kokoro settings)
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });
  const { data: voicesData } = api.onoma.getKokoroVoices.useQuery(undefined, {
    staleTime: 600000,
  });
  const suggestMutation = api.onoma.suggestPhonemes.useMutation();

  const [editingPron, setEditingPron] = useState(false);
  const [ipaDraft, setIpaDraft] = useState("");
  const [voiceDraft, setVoiceDraft] = useState("");
  const [overridesVersion, setOverridesVersion] = useState(0);

  const {
    searchTerm,
    setSearchTerm,
    filteredTerms,
    selectedTerm,
    setSelectedTerm,
    definitions,
    lexEditPos,
    setLexEditPos,
    lexEditRoot,
    setLexEditRoot,
    lexEditMeaning,
    setLexEditMeaning,
    lexEditOrigin,
    setLexEditOrigin,
    selectedTermIpa,
    selectedTermCyrillic,
    selectedTermGreek,
    selectedTermArabic,
    selectedTermMorphology,
    classifiedCulture,
    handleSaveLexiconDefinition,
    handleDeleteTerm,
  } = state;

  const stashedEntry = state.bank.nameBank?.find(
    (entry) => entry.type === "saved-name" && entry.title === selectedTerm
  );

  const originLabel = stashedEntry
    ? stashedEntry.setName
      ? `Dictionary: ${stashedEntry.setName}`
      : stashedEntry.category
        ? `Category: ${stashedEntry.category}`
        : "Saved name"
    : null;

  useEffect(() => {
    setEditingPron(false);
    if (selectedTerm) {
      const over = getNameOverride(selectedTerm);
      setIpaDraft(over?.ipa || "");
      setVoiceDraft(over?.voice || "");
    }
  }, [selectedTerm, overridesVersion]);

  const hasOverride = selectedTerm ? !!getNameOverride(selectedTerm) : false;
  const effectiveIpa = selectedTerm ? getNameOverride(selectedTerm)?.ipa || selectedTermIpa : "";

  const savePron = () => {
    if (!selectedTerm) return;
    const cleanIpa = ipaDraft.trim();
    setNameOverride(selectedTerm, { ipa: cleanIpa || undefined, voice: voiceDraft || undefined });
    setEditingPron(false);
    setOverridesVersion((v) => v + 1);
    notify.success("Pronunciation saved successfully!");
  };

  const previewPron = async () => {
    if (!selectedTerm) return;
    try {
      await speakName({
        name: selectedTerm,
        ipa: ipaDraft || selectedTermIpa,
        culture: classifiedCulture || null,
        kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
        voice: voiceDraft,
        defaultVoice: speechConfig?.kokoro?.voice,
      });
    } catch (err) {
      console.error("Preview failed:", err);
      notify.error("Preview failed.");
    }
  };

  const resetPron = () => {
    if (!selectedTerm) return;
    setNameOverride(selectedTerm, {});
    setIpaDraft("");
    setVoiceDraft("");
    setEditingPron(false);
    setOverridesVersion((v) => v + 1);
    notify.success("Pronunciation reset to conlang defaults.");
  };

  return (
    <div className="animate-in fade-in grid items-start gap-6 duration-300 lg:grid-cols-12">
      {/* Left Column: Terms List (4/12) */}
      <div className="space-y-4 lg:col-span-4">
        <FacetCard className="border-border/40 bg-secondary/5 space-y-4 border p-4">
          <div className="space-y-1">
            <h3 className="text-foreground text-sm font-bold tracking-tight">Lexicon Terms</h3>
            <p className="text-muted-foreground text-xs">Stashed names and defined vocabulary.</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search terms, roots..."
              className="border-border/60 bg-background text-foreground placeholder-muted-foreground w-full rounded-xl border py-2 pr-4 pl-9 text-sm focus:border-onoma-primary/50 focus:outline-none"
            />
          </div>

          {/* List */}
          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {filteredTerms.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                {searchTerm
                  ? "No matching terms found."
                  : "No terms in lexicon. Stash names in the workshop to define them."}
              </p>
            ) : (
              filteredTerms.map((name) => {
                const def = definitions[name];
                const isSelected = selectedTerm === name;
                return (
                  <div
                    key={name}
                    onClick={() => setSelectedTerm(name)}
                    className={cn(
                      "group flex w-full cursor-pointer items-center justify-between rounded-xl border p-3 text-left transition-all duration-200 select-none",
                      isSelected
                        ? "text-foreground border-onoma-primary/30 bg-onoma-primary/10"
                        : "bg-background hover:bg-secondary/20 border-border/40 text-foreground"
                    )}
                  >
                    <div className="min-w-0 space-y-0.5 pr-2">
                      <span className="block truncate font-mono text-sm font-bold">{name}</span>
                      {def ? (
                        <span className="text-muted-foreground block truncate text-[10px]">
                          <span className="mr-1 font-bold text-onoma-primary">
                            [{def.partOfSpeech}]
                          </span>
                          {def.meaning}
                        </span>
                      ) : (
                        <span className="text-muted-foreground block truncate text-[10px] italic">
                          Undefined stashed word
                        </span>
                      )}
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Are you sure you want to delete "${name}" from stashed names and dictionary definitions?`
                          )
                        ) {
                          await handleDeleteTerm(name);
                        }
                      }}
                      title="Delete term"
                      className="text-muted-foreground cursor-pointer rounded-lg p-1 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </FacetCard>
      </div>

      {/* Right Column: Selected Term Details (8/12) */}
      <div className="lg:col-span-8">
        {selectedTerm ? (
          <FacetCard className="border-border/40 bg-secondary/5 animate-in fade-in space-y-6 border p-5 duration-300">
            {/* Word Title Header */}
            <div className="border-border/40 flex items-start justify-between border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground font-mono text-xl font-bold">{selectedTerm}</h3>
                  {definitions[selectedTerm]?.partOfSpeech && (
                    <span className="rounded-md bg-onoma-primary/10 px-2 py-0.5 text-xs font-bold text-onoma-primary uppercase">
                      {definitions[selectedTerm].partOfSpeech}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                  {effectiveIpa && (
                    <span className="flex items-center">
                      <button
                        onClick={async () => {
                          try {
                            await speakName({
                              name: selectedTerm,
                              ipa: effectiveIpa,
                              culture: classifiedCulture || null,
                              kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
                              voice: getNameOverride(selectedTerm)?.voice,
                              defaultVoice: speechConfig?.kokoro?.voice,
                            });
                          } catch (err) {
                            console.error("Pronunciation playback failed:", err);
                            notify.error("Could not play this pronunciation.");
                          }
                        }}
                        title="Listen to pronunciation"
                        className={cn(
                          "text-muted-foreground border-border/40 bg-background flex cursor-pointer items-center gap-1 rounded-l-full border px-2.5 py-0.5 font-mono text-[10px] transition-all duration-200 hover:bg-onoma-primary/10 hover:text-onoma-primary",
                          hasOverride && "border-onoma-primary/40 text-onoma-primary"
                        )}
                      >
                        <Volume2 className="h-3 w-3" />
                        <span>{effectiveIpa}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPron(!editingPron)}
                        title={hasOverride ? "Edit custom pronunciation" : "Customize IPA / voice"}
                        className={cn(
                          "text-muted-foreground border-border/40 bg-background flex cursor-pointer items-center rounded-r-full border border-l-0 px-2 py-0.5 transition-all duration-200 select-none hover:bg-onoma-primary/10 hover:text-onoma-primary",
                          hasOverride && "border-onoma-primary/40 text-onoma-primary"
                        )}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  <span>
                    Culture: <span className="text-foreground capitalize">{classifiedCulture}</span>
                  </span>
                  {stashedEntry && (
                    <>
                      <span>•</span>
                      {originLabel && (
                        <span className="rounded bg-onoma-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-onoma-primary capitalize">
                          {originLabel}
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        Stashed{" "}
                        <span className="text-foreground font-semibold">
                          {new Date(stashedEntry.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${selectedTerm}"?`)) {
                    handleDeleteTerm(selectedTerm);
                  }
                }}
                className="text-muted-foreground bg-background border-border/40 flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Word</span>
              </button>
            </div>

            {/* Inline Pronunciation Editor */}
            {editingPron && (
              <div className="border-border/20 animate-in slide-in-from-top-1 relative z-10 w-full space-y-2.5 rounded-xl border bg-onoma-primary/[0.02] p-3 text-left duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-foreground text-[10px] font-bold tracking-wider uppercase">
                    Customize Pronunciation
                  </h4>
                  <button
                    onClick={() => setEditingPron(false)}
                    title="Close"
                    className="text-muted-foreground cursor-pointer rounded p-0.5 hover:text-onoma-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <label className="text-muted-foreground text-[8px] font-bold uppercase">
                      IPA (drives Read Naturally phonemes)
                    </label>
                    {speechConfig?.kokoro?.enabled &&
                      speechConfig?.kokoro?.engine === "kokoro-fastapi" && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await suggestMutation.mutateAsync({ text: selectedTerm });
                              if (res.phonemes) {
                                setIpaDraft(res.phonemes);
                                notify.success("Suggested IPA loaded.");
                              } else {
                                notify.error("Could not generate IPA suggestion.");
                              }
                            } catch (err: any) {
                              notify.error(err.message || "Failed to fetch suggestion.");
                            }
                          }}
                          disabled={suggestMutation.isPending}
                          className="flex cursor-pointer items-center gap-1 text-[8px] font-bold text-onoma-primary select-none hover:underline disabled:opacity-50"
                        >
                          {suggestMutation.isPending ? "Suggesting..." : "Suggest IPA"}
                        </button>
                      )}
                  </div>
                  <input
                    type="text"
                    value={ipaDraft}
                    onChange={(e) => setIpaDraft(e.target.value)}
                    placeholder="/ˈeksɑːmpl/"
                    className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2 py-1 font-mono text-xs focus:outline-none"
                  />
                  {speechConfig?.kokoro?.enabled &&
                    (() => {
                      const result = ipaToKokoroPhonemes(ipaDraft);
                      return (
                        <div className="text-muted-foreground mt-1 flex flex-wrap gap-1 font-mono text-[9px]">
                          <span>Phonemes: {result.phonemes || "(empty)"}</span>
                          {result.dropped.length > 0 && (
                            <span className="font-semibold text-amber-500">
                              (dropped: {result.dropped.join(", ")})
                            </span>
                          )}
                        </div>
                      );
                    })()}
                </div>

                <div className="space-y-0.5">
                  <label className="text-muted-foreground text-[8px] font-bold uppercase">
                    Voice
                  </label>
                  <Select
                    value={voiceDraft || "default"}
                    onValueChange={(val) => setVoiceDraft(val === "default" ? "" : val)}
                  >
                    <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2 py-1 text-xs transition-colors focus:outline-none">
                      <SelectValue placeholder="Default / culture voice" />
                    </SelectTrigger>
                    <SelectContent className="border-border/40 bg-background/95 max-h-[200px] backdrop-blur-md">
                      <SelectItem
                        value="default"
                        className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                      >
                        Default / culture voice
                      </SelectItem>
                      {(voicesData?.voices ?? []).map((v: string) => (
                        <SelectItem
                          key={v}
                          value={v}
                          className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                        >
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <button
                    onClick={resetPron}
                    title="Reset to defaults"
                    className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                  <div className="flex gap-1.5">
                    <button
                      onClick={previewPron}
                      className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold transition-colors"
                    >
                      <Volume2 className="h-3 w-3" /> Preview
                    </button>
                    <button
                      onClick={savePron}
                      className="cursor-pointer rounded bg-onoma-primary px-2.5 py-0.5 text-[9px] font-bold text-white transition-colors hover:bg-onoma-primary-light"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Transcriptions Grid */}
            <div className="space-y-2">
              <h4 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Orthographic Transcriptions
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTermCyrillic);
                      alert(`Copied Cyrillic: ${selectedTermCyrillic}`);
                    } catch {}
                  }}
                  className="border-border/40 bg-background group cursor-pointer rounded-xl border p-3 text-center transition-all duration-200 select-none hover:border-onoma-primary/40"
                >
                  <span className="text-muted-foreground mb-1 block text-xs text-[10px] font-bold tracking-wider uppercase">
                    Cyrillic
                  </span>
                  <span className="font-mono text-sm font-bold text-onoma-primary">
                    {selectedTermCyrillic}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-[9px] opacity-0 transition-opacity group-hover:opacity-100">
                    Click to copy
                  </span>
                </div>

                <div
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTermGreek);
                      alert(`Copied Greek: ${selectedTermGreek}`);
                    } catch {}
                  }}
                  className="border-border/40 bg-background group cursor-pointer rounded-xl border p-3 text-center transition-all duration-200 select-none hover:border-onoma-primary/40"
                >
                  <span className="text-muted-foreground mb-1 block text-xs text-[10px] font-bold tracking-wider uppercase">
                    Greek
                  </span>
                  <span className="font-mono text-sm font-bold text-onoma-primary">
                    {selectedTermGreek}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-[9px] opacity-0 transition-opacity group-hover:opacity-100">
                    Click to copy
                  </span>
                </div>

                <div
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTermArabic);
                      alert(`Copied Arabic: ${selectedTermArabic}`);
                    } catch {}
                  }}
                  className="border-border/40 bg-background group cursor-pointer rounded-xl border p-3 text-center transition-all duration-200 select-none hover:border-onoma-primary/40"
                  dir="rtl"
                >
                  <span
                    className="text-muted-foreground mb-1 block text-left font-sans text-xs text-[10px] font-bold tracking-wider uppercase"
                    dir="ltr"
                  >
                    Arabic
                  </span>
                  <span className="font-mono text-sm font-bold text-onoma-primary">
                    {selectedTermArabic}
                  </span>
                  <span
                    className="text-muted-foreground mt-1 block text-left font-sans text-[9px] opacity-0 transition-opacity group-hover:opacity-100"
                    dir="ltr"
                  >
                    Click to copy
                  </span>
                </div>
              </div>
            </div>

            {/* Lexical & Phonotactic Analysis */}
            <LexiconAnalysis
              selectedTerm={selectedTerm}
              stashedEntry={stashedEntry}
              originLabel={originLabel}
            />

            {/* Case Declension Table */}
            {selectedTermMorphology && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Noun Declension (Cases)
                  </h4>
                  <span className="text-muted-foreground text-[10px] font-semibold">
                    Gender:{" "}
                    <span className="font-bold text-onoma-primary uppercase">
                      {selectedTermMorphology.gender}
                    </span>
                  </span>
                </div>

                <div className="border-border/40 bg-background overflow-hidden rounded-xl border">
                  <div className="bg-secondary/10 border-border/40 text-muted-foreground grid grid-cols-3 border-b px-3 py-2 text-[10px] font-bold tracking-wider uppercase">
                    <span>Case</span>
                    <span>Singular</span>
                    <span>Plural</span>
                  </div>

                  <div className="divide-border/20 divide-y text-xs">
                    {Object.entries(selectedTermMorphology.declensionTable).map(
                      ([caseName, declCase]) => (
                        <div key={caseName} className="grid grid-cols-3 items-center px-3 py-2.5">
                          <div className="flex flex-col pr-1">
                            <span className="text-foreground font-bold capitalize">{caseName}</span>
                            <span className="text-muted-foreground mt-0.5 text-[9px] leading-normal">
                              {declCase.descriptionSingular.split(" (")[0]}
                            </span>
                          </div>
                          <span className="truncate font-mono font-semibold text-onoma-primary">
                            {declCase.singular}
                          </span>
                          <span className="truncate font-mono font-semibold text-onoma-primary">
                            {declCase.plural}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Definition Edit Form */}
            <LexiconDefinitionForm
              lexEditPos={lexEditPos}
              setLexEditPos={setLexEditPos}
              lexEditRoot={lexEditRoot}
              setLexEditRoot={setLexEditRoot}
              lexEditMeaning={lexEditMeaning}
              setLexEditMeaning={setLexEditMeaning}
              lexEditOrigin={lexEditOrigin}
              setLexEditOrigin={setLexEditOrigin}
              onSubmit={handleSaveLexiconDefinition}
            />
          </FacetCard>
        ) : (
          <FacetCard className="border-border/40 bg-secondary/5 text-muted-foreground flex min-h-[400px] flex-col items-center justify-center border border-dashed p-8 text-center text-sm">
            <BookOpen className="mb-3 h-8 w-8 animate-pulse text-onoma-primary/40" />
            <p className="font-semibold">No word selected</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Select a conlang vocabulary term from the left list to view script transcriptions,
              noun case declensions, and edit its lexical definition.
            </p>
          </FacetCard>
        )}
      </div>
    </div>
  );
}
