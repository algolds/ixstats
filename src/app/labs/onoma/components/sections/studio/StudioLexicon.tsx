"use client";

// src/app/labs/onoma/components/sections/studio/StudioLexicon.tsx
// Onoma Custom Studio Lexicon Dictionary View

import { BookOpen, Search, Volume2, Trash2 } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { type StudioState } from "../../../hooks/useStudioState";

interface StudioLexiconProps {
  state: StudioState;
}

export function StudioLexicon({ state }: StudioLexiconProps) {
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
    <div className="grid gap-6 lg:grid-cols-12 items-start animate-in fade-in duration-300">
      {/* Left Column: Terms List (4/12) */}
      <div className="lg:col-span-4 space-y-4">
        <FacetCard className="p-4 border border-border/40 bg-secondary/5 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold tracking-tight text-foreground">Lexicon Terms</h3>
            <p className="text-xs text-muted-foreground">
              Stashed names and defined vocabulary.
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search terms, roots..."
              className="w-full rounded-xl border border-border/60 bg-background pl-9 pr-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-[#0091ff]/50 focus:outline-none"
            />
          </div>

          {/* List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredTerms.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-6">
                {searchTerm ? "No matching terms found." : "No terms in lexicon. Stash names in the workshop to define them."}
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
                      "w-full flex items-center justify-between text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none group",
                      isSelected
                        ? "bg-[#0091ff]/10 border-[#0091ff]/30 text-foreground"
                        : "bg-background hover:bg-secondary/20 border-border/40 text-foreground"
                    )}
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <span className="font-bold font-mono text-sm block truncate">{name}</span>
                      {def ? (
                        <span className="text-[10px] text-muted-foreground block truncate">
                          <span className="font-bold text-[#0091ff] mr-1">[{def.partOfSpeech}]</span>
                          {def.meaning}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic block truncate">
                          Undefined stashed word
                        </span>
                      )}
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete "${name}" from stashed names and dictionary definitions?`)) {
                          await handleDeleteTerm(name);
                        }
                      }}
                      title="Delete term"
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 text-muted-foreground p-1 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
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
          <FacetCard className="p-5 border border-border/40 bg-secondary/5 space-y-6 animate-in fade-in duration-300">
            
            {/* Word Title Header */}
            <div className="flex justify-between items-start border-b border-border/40 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold font-mono text-foreground">{selectedTerm}</h3>
                  {definitions[selectedTerm]?.partOfSpeech && (
                    <span className="text-xs bg-[#0091ff]/10 text-[#0091ff] px-2 py-0.5 rounded-md font-bold uppercase">
                      {definitions[selectedTerm].partOfSpeech}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {selectedTermIpa && (
                    <button
                      onClick={() => {
                        if (typeof window !== "undefined" && window.speechSynthesis) {
                          window.speechSynthesis.cancel();
                          const utterance = new SpeechSynthesisUtterance(selectedTerm);
                          utterance.rate = 0.85;
                          window.speechSynthesis.speak(utterance);
                        }
                      }}
                      title="Listen to pronunciation"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#0091ff] hover:bg-[#0091ff]/10 border border-border/40 bg-background px-2.5 py-0.5 rounded-full transition-all duration-200 cursor-pointer font-mono"
                    >
                      <Volume2 className="h-3 w-3" />
                      <span>{selectedTermIpa}</span>
                    </button>
                  )}
                  <span className="text-[10px] text-muted-foreground font-semibold">
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
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 bg-background hover:bg-red-500/10 border border-border/40 hover:border-red-500/20 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Word</span>
              </button>
            </div>

            {/* Transcriptions Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Orthographic Transcriptions</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTermCyrillic);
                      alert(`Copied Cyrillic: ${selectedTermCyrillic}`);
                    } catch {}
                  }}
                  className="p-3 rounded-xl border border-border/40 bg-background hover:border-[#0091ff]/40 transition-all duration-200 cursor-pointer select-none group text-center"
                >
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider mb-1 text-xs">Cyrillic</span>
                  <span className="font-mono text-sm font-bold text-[#0091ff]">{selectedTermCyrillic}</span>
                  <span className="text-[9px] text-muted-foreground block opacity-0 group-hover:opacity-100 transition-opacity mt-1">Click to copy</span>
                </div>

                <div
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTermGreek);
                      alert(`Copied Greek: ${selectedTermGreek}`);
                    } catch {}
                  }}
                  className="p-3 rounded-xl border border-border/40 bg-background hover:border-[#0091ff]/40 transition-all duration-200 cursor-pointer select-none group text-center"
                >
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider mb-1 text-xs">Greek</span>
                  <span className="font-mono text-sm font-bold text-[#0091ff]">{selectedTermGreek}</span>
                  <span className="text-[9px] text-muted-foreground block opacity-0 group-hover:opacity-100 transition-opacity mt-1">Click to copy</span>
                </div>

                <div
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTermArabic);
                      alert(`Copied Arabic: ${selectedTermArabic}`);
                    } catch {}
                  }}
                  className="p-3 rounded-xl border border-border/40 bg-background hover:border-[#0091ff]/40 transition-all duration-200 cursor-pointer select-none group text-center"
                  dir="rtl"
                >
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider mb-1 text-left text-xs font-sans" dir="ltr">Arabic</span>
                  <span className="font-mono text-sm font-bold text-[#0091ff]">{selectedTermArabic}</span>
                  <span className="text-[9px] text-muted-foreground block opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-left font-sans" dir="ltr">Click to copy</span>
                </div>
              </div>
            </div>

            {/* Case Declension Table */}
            {selectedTermMorphology && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Noun Declension (Cases)</h4>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Gender: <span className="text-[#0091ff] font-bold uppercase">{selectedTermMorphology.gender}</span>
                  </span>
                </div>

                <div className="border border-border/40 rounded-xl overflow-hidden bg-background">
                  <div className="grid grid-cols-3 bg-secondary/10 px-3 py-2 text-[10px] font-bold border-b border-border/40 text-muted-foreground uppercase tracking-wider">
                    <span>Case</span>
                    <span>Singular</span>
                    <span>Plural</span>
                  </div>

                  <div className="divide-y divide-border/20 text-xs">
                    {Object.entries(selectedTermMorphology.declensionTable).map(([caseName, declCase]) => (
                      <div key={caseName} className="grid grid-cols-3 px-3 py-2.5 items-center">
                        <div className="flex flex-col pr-1">
                          <span className="font-bold text-foreground capitalize">{caseName}</span>
                          <span className="text-[9px] text-muted-foreground leading-normal mt-0.5">
                            {declCase.descriptionSingular.split(" (")[0]}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-[#0091ff] truncate">{declCase.singular}</span>
                        <span className="font-mono font-semibold text-[#0091ff] truncate">{declCase.plural}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Definition Edit Form */}
            <div className="border-t border-border/20 pt-5">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Define Lexicon Meaning</h4>
              <form onSubmit={handleSaveLexiconDefinition} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Part of Speech</label>
                    <select
                      value={lexEditPos}
                      onChange={(e) => setLexEditPos(e.target.value)}
                      className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-foreground focus:border-[#0091ff]/50 focus:outline-none"
                    >
                      <option value="Noun">Noun</option>
                      <option value="Adjective">Adjective</option>
                      <option value="Verb">Verb</option>
                      <option value="Proper Noun">Proper Noun</option>
                      <option value="Adverb">Adverb</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Etymological Root</label>
                    <input
                      type="text"
                      value={lexEditRoot}
                      onChange={(e) => setLexEditRoot(e.target.value)}
                      placeholder="e.g. rom- (strength)"
                      className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-foreground focus:border-[#0091ff]/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Meaning / Translation</label>
                  <input
                    type="text"
                    value={lexEditMeaning}
                    onChange={(e) => setLexEditMeaning(e.target.value)}
                    placeholder="e.g. Place of strength, capital city"
                    required
                    className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-foreground focus:border-[#0091ff]/50 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Historical Origin & Notes</label>
                  <textarea
                    value={lexEditOrigin}
                    onChange={(e) => setLexEditOrigin(e.target.value)}
                    placeholder="e.g. Named after legendary founder Romus, later expanded by Latin tribes..."
                    className="w-full h-20 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-foreground focus:border-[#0091ff]/50 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#0091ff] hover:bg-[#33a7ff] text-xs font-bold text-white py-2 transition-all shadow-md shadow-[#0091ff]/10"
                >
                  Save Lexicon Definition
                </button>
              </form>
            </div>

          </FacetCard>
        ) : (
          <FacetCard className="p-8 border border-border/40 border-dashed bg-secondary/5 text-center text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[400px]">
            <BookOpen className="h-8 w-8 text-[#0091ff]/40 mb-3 animate-pulse" />
            <p className="font-semibold">No word selected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select a conlang vocabulary term from the left list to view script transcriptions, noun case declensions, and edit its lexical definition.
            </p>
          </FacetCard>
        )}
      </div>
    </div>
  );
}
