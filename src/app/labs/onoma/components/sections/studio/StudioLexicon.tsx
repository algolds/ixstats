"use client";

// src/app/labs/onoma/components/sections/studio/StudioLexicon.tsx
// Onoma Custom Studio Lexicon Dictionary View

import { BookOpen, Search, Volume2, Trash2 } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { type StudioState } from "../../../hooks/useStudioState";
import { api } from "~/trpc/react";
import { speakName } from "~/lib/onoma/browser-speech";
import { getNameOverride } from "~/lib/onoma/ipa-overrides";
import { useNotify } from "~/hooks/useNotify";

interface StudioLexiconProps {
  state: StudioState;
}

export function StudioLexicon({ state }: StudioLexiconProps) {
  const notify = useNotify();

  // Load public speech config (including Kokoro settings)
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

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
              className="border-border/60 bg-background text-foreground placeholder-muted-foreground w-full rounded-xl border py-2 pr-4 pl-9 text-sm focus:border-[#0091ff]/50 focus:outline-none"
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
                        ? "text-foreground border-[#0091ff]/30 bg-[#0091ff]/10"
                        : "bg-background hover:bg-secondary/20 border-border/40 text-foreground"
                    )}
                  >
                    <div className="min-w-0 space-y-0.5 pr-2">
                      <span className="block truncate font-mono text-sm font-bold">{name}</span>
                      {def ? (
                        <span className="text-muted-foreground block truncate text-[10px]">
                          <span className="mr-1 font-bold text-[#0091ff]">
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
                    <span className="rounded-md bg-[#0091ff]/10 px-2 py-0.5 text-xs font-bold text-[#0091ff] uppercase">
                      {definitions[selectedTerm].partOfSpeech}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {selectedTermIpa && (
                    <button
                      onClick={async () => {
                        try {
                          await speakName({
                            name: selectedTerm,
                            ipa: selectedTermIpa,
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
                      className="text-muted-foreground border-border/40 bg-background flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition-all duration-200 hover:bg-[#0091ff]/10 hover:text-[#0091ff]"
                    >
                      <Volume2 className="h-3 w-3" />
                      <span>{selectedTermIpa}</span>
                    </button>
                  )}
                  <span className="text-muted-foreground text-[10px] font-semibold">
                    Culture: <span className="text-foreground capitalize">{classifiedCulture}</span>
                  </span>
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
                  className="border-border/40 bg-background group cursor-pointer rounded-xl border p-3 text-center transition-all duration-200 select-none hover:border-[#0091ff]/40"
                >
                  <span className="text-muted-foreground mb-1 block text-xs text-[10px] font-bold tracking-wider uppercase">
                    Cyrillic
                  </span>
                  <span className="font-mono text-sm font-bold text-[#0091ff]">
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
                  className="border-border/40 bg-background group cursor-pointer rounded-xl border p-3 text-center transition-all duration-200 select-none hover:border-[#0091ff]/40"
                >
                  <span className="text-muted-foreground mb-1 block text-xs text-[10px] font-bold tracking-wider uppercase">
                    Greek
                  </span>
                  <span className="font-mono text-sm font-bold text-[#0091ff]">
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
                  className="border-border/40 bg-background group cursor-pointer rounded-xl border p-3 text-center transition-all duration-200 select-none hover:border-[#0091ff]/40"
                  dir="rtl"
                >
                  <span
                    className="text-muted-foreground mb-1 block text-left font-sans text-xs text-[10px] font-bold tracking-wider uppercase"
                    dir="ltr"
                  >
                    Arabic
                  </span>
                  <span className="font-mono text-sm font-bold text-[#0091ff]">
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

            {/* Case Declension Table */}
            {selectedTermMorphology && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Noun Declension (Cases)
                  </h4>
                  <span className="text-muted-foreground text-[10px] font-semibold">
                    Gender:{" "}
                    <span className="font-bold text-[#0091ff] uppercase">
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
                          <span className="truncate font-mono font-semibold text-[#0091ff]">
                            {declCase.singular}
                          </span>
                          <span className="truncate font-mono font-semibold text-[#0091ff]">
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
            <div className="border-border/20 border-t pt-5">
              <h4 className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
                Define Lexicon Meaning
              </h4>
              <form onSubmit={handleSaveLexiconDefinition} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-[10px] font-bold uppercase">
                      Part of Speech
                    </label>
                    <select
                      value={lexEditPos}
                      onChange={(e) => setLexEditPos(e.target.value)}
                      className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-xs focus:border-[#0091ff]/50 focus:outline-none"
                    >
                      <option value="Noun">Noun</option>
                      <option value="Adjective">Adjective</option>
                      <option value="Verb">Verb</option>
                      <option value="Proper Noun">Proper Noun</option>
                      <option value="Adverb">Adverb</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground text-[10px] font-bold uppercase">
                      Etymological Root
                    </label>
                    <input
                      type="text"
                      value={lexEditRoot}
                      onChange={(e) => setLexEditRoot(e.target.value)}
                      placeholder="e.g. rom- (strength)"
                      className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-xs focus:border-[#0091ff]/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase">
                    Meaning / Translation
                  </label>
                  <input
                    type="text"
                    value={lexEditMeaning}
                    onChange={(e) => setLexEditMeaning(e.target.value)}
                    placeholder="e.g. Place of strength, capital city"
                    required
                    className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-xs focus:border-[#0091ff]/50 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase">
                    Historical Origin & Notes
                  </label>
                  <textarea
                    value={lexEditOrigin}
                    onChange={(e) => setLexEditOrigin(e.target.value)}
                    placeholder="e.g. Named after legendary founder Romus, later expanded by Latin tribes..."
                    className="border-border/60 bg-background text-foreground h-20 w-full rounded-lg border px-3 py-2 text-xs focus:border-[#0091ff]/50 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#0091ff] py-2 text-xs font-bold text-white shadow-md shadow-[#0091ff]/10 transition-all hover:bg-[#33a7ff]"
                >
                  Save Lexicon Definition
                </button>
              </form>
            </div>
          </FacetCard>
        ) : (
          <FacetCard className="border-border/40 bg-secondary/5 text-muted-foreground flex min-h-[400px] flex-col items-center justify-center border border-dashed p-8 text-center text-sm">
            <BookOpen className="mb-3 h-8 w-8 animate-pulse text-[#0091ff]/40" />
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
