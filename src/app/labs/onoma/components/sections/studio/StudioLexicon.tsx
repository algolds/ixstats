"use client";

import { PronunciationEditor } from "../../shared/PronunciationEditor";
import { useState, useEffect } from "react";
import {
  OpenBook as BookOpen,
  Search,
  SoundHigh as Volume2,
  Trash as Trash2,
  EditPencil as Pencil,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { type StudioState } from "../../../hooks/useStudioState";
import { api } from "~/trpc/react";
import { speakName } from "~/lib/onoma/browser-speech";
import { getNameOverride, setNameOverride } from "~/lib/onoma/ipa-overrides";
import { useNotify } from "~/hooks/useNotify";
import { LexiconAnalysis } from "./LexiconAnalysis";
import { LexiconDefinitionForm } from "./LexiconDefinitionForm";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { ActionPill } from "~/components/ui/action-pill";
import { Card } from "~/components/ui/card";

interface StudioLexiconProps {
  state: StudioState;
}

export function StudioLexicon({ state }: StudioLexiconProps) {
  const notify = useNotify();

  // Load public speech config (including Kokoro settings)
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

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
    // oxlint-disable-next-line
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
        <Card variant="inset" padding="none" className="space-y-4 p-4">
          <div className="space-y-1">
            <h3 className="text-label text-body font-semibold">Lexicon terms</h3>
            <p className="text-label-secondary text-footnote">
              Stashed names and defined vocabulary.
            </p>
          </div>

          <div className="relative">
            <Search className="text-label-secondary absolute top-2 left-3 h-4 w-4" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search terms, roots..."
              className="text-body w-full pr-4 pl-9"
            />
          </div>

          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {filteredTerms.length === 0 ? (
              <p className="text-label-secondary text-footnote py-6 text-center">
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
                      "group rounded-row flex w-full cursor-pointer items-center justify-between border p-3 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 select-none",
                      isSelected
                        ? "text-label border-tint/30 bg-tint/10"
                        : "bg-background hover:bg-fill-4 border-separator text-label"
                    )}
                  >
                    <div className="min-w-0 space-y-0.5 pr-2">
                      <span className="text-body block truncate font-mono font-semibold">
                        {name}
                      </span>
                      {def ? (
                        <span className="text-label-secondary text-caption block truncate">
                          <span className="text-tint mr-1 font-semibold">[{def.partOfSpeech}]</span>
                          {def.meaning}
                        </span>
                      ) : (
                        <span className="text-label-secondary text-caption block truncate italic">
                          Undefined stashed word
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
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
                      aria-label="Delete term"
                      className="text-label-secondary hover:text-red hover:bg-red/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Right Column: Selected Term Details (8/12) */}
      <div className="lg:col-span-8">
        {selectedTerm ? (
          <Card
            variant="inset"
            padding="none"
            className="animate-in fade-in space-y-6 p-5 duration-300"
          >
            <div className="border-separator flex items-start justify-between border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-label text-title-2 font-mono font-bold">{selectedTerm}</h3>
                  {definitions[selectedTerm]?.partOfSpeech && (
                    <span className="bg-tint/10 text-tint rounded-control-sm text-eyebrow px-2 py-0.5">
                      {definitions[selectedTerm].partOfSpeech}
                    </span>
                  )}
                </div>
                <div className="text-label-secondary text-caption mt-1 flex flex-wrap items-center gap-2 font-semibold">
                  {effectiveIpa && (
                    <span className="flex items-center">
                      <ActionPill
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
                        aria-label={`Listen to pronunciation /${effectiveIpa}/`}
                        icon={<Volume2 />}
                        className={cn(
                          "border-separator bg-surface hover:bg-tint/10 hover:text-tint rounded-r-none border font-mono",
                          hasOverride && "border-tint/40 text-tint"
                        )}
                      >
                        {effectiveIpa}
                      </ActionPill>
                      <ActionPill
                        pressed={editingPron}
                        onClick={() => setEditingPron(!editingPron)}
                        title={hasOverride ? "Edit custom pronunciation" : "Customize IPA / voice"}
                        aria-label={
                          hasOverride ? "Edit custom pronunciation" : "Customize IPA / voice"
                        }
                        icon={<Pencil />}
                        className={cn(
                          "border-separator bg-surface hover:bg-tint/10 hover:text-tint rounded-l-none border border-l-0 px-2",
                          hasOverride && "border-tint/40 text-tint"
                        )}
                      />
                    </span>
                  )}
                  <span>
                    Culture: <span className="text-label capitalize">{classifiedCulture}</span>
                  </span>
                  {stashedEntry && (
                    <>
                      <span>•</span>
                      {originLabel && (
                        <span className="bg-tint/10 text-tint rounded-control-sm text-caption px-2 py-0.5 font-semibold capitalize">
                          {originLabel}
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        Stashed{" "}
                        <span className="text-label font-semibold">
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

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${selectedTerm}"?`)) {
                    handleDeleteTerm(selectedTerm);
                  }
                }}
                className="text-label-secondary hover:text-red hover:bg-red/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete word</span>
              </Button>
            </div>

            {editingPron && (
              <PronunciationEditor
                name={selectedTerm}
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

            <div className="space-y-2">
              <h4 className="text-label-secondary text-subhead">Orthographic transcriptions</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTermCyrillic);
                      alert(`Copied Cyrillic: ${selectedTermCyrillic}`);
                    } catch {
                      // clipboard unavailable (permission denied / insecure context) — nothing copied
                    }
                  }}
                  className="rounded-row group hover:border-tint/40 h-auto flex-col gap-0 p-3 font-normal whitespace-normal"
                >
                  <span className="text-label-secondary text-eyebrow text-caption mb-1 block">
                    Cyrillic
                  </span>
                  <span className="text-tint text-body font-mono font-semibold">
                    {selectedTermCyrillic}
                  </span>
                  <span className="text-label-secondary text-caption mt-1 block opacity-0 transition-opacity group-hover:opacity-100">
                    Click to copy
                  </span>
                </Button>

                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTermGreek);
                      alert(`Copied Greek: ${selectedTermGreek}`);
                    } catch {
                      // clipboard unavailable (permission denied / insecure context) — nothing copied
                    }
                  }}
                  className="rounded-row group hover:border-tint/40 h-auto flex-col gap-0 p-3 font-normal whitespace-normal"
                >
                  <span className="text-label-secondary text-eyebrow text-caption mb-1 block">
                    Greek
                  </span>
                  <span className="text-tint text-body font-mono font-semibold">
                    {selectedTermGreek}
                  </span>
                  <span className="text-label-secondary text-caption mt-1 block opacity-0 transition-opacity group-hover:opacity-100">
                    Click to copy
                  </span>
                </Button>

                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedTermArabic);
                      alert(`Copied Arabic: ${selectedTermArabic}`);
                    } catch {
                      // clipboard unavailable (permission denied / insecure context) — nothing copied
                    }
                  }}
                  className="rounded-row group hover:border-tint/40 h-auto flex-col gap-0 p-3 font-normal whitespace-normal"
                  dir="rtl"
                >
                  <span
                    className="text-label-secondary text-eyebrow text-caption mb-1 block text-left font-sans"
                    dir="ltr"
                  >
                    Arabic
                  </span>
                  <span className="text-tint text-body font-mono font-semibold">
                    {selectedTermArabic}
                  </span>
                  <span
                    className="text-label-secondary text-caption mt-1 block text-left font-sans opacity-0 transition-opacity group-hover:opacity-100"
                    dir="ltr"
                  >
                    Click to copy
                  </span>
                </Button>
              </div>
            </div>

            <LexiconAnalysis
              selectedTerm={selectedTerm}
              stashedEntry={stashedEntry}
              originLabel={originLabel}
            />

            {selectedTermMorphology && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-label-secondary text-subhead">Noun Declension (Cases)</h4>
                  <span className="text-label-secondary text-caption font-semibold">
                    Gender:{" "}
                    <span className="text-tint font-semibold">{selectedTermMorphology.gender}</span>
                  </span>
                </div>

                <div className="border-separator bg-background rounded-row overflow-hidden border">
                  <div className="bg-fill-4 border-separator text-label-secondary text-eyebrow grid grid-cols-3 border-b px-3 py-2">
                    <span>Case</span>
                    <span>Singular</span>
                    <span>Plural</span>
                  </div>

                  <div className="divide-separator text-footnote divide-y">
                    {Object.entries(selectedTermMorphology.declensionTable).map(
                      ([caseName, declCase]) => (
                        <div key={caseName} className="grid grid-cols-3 items-center px-3 py-2">
                          <div className="flex flex-col pr-1">
                            <span className="text-label font-semibold capitalize">{caseName}</span>
                            <span className="text-label-secondary text-caption mt-0.5 leading-normal">
                              {declCase.descriptionSingular.split(" (")[0]}
                            </span>
                          </div>
                          <span className="text-tint truncate font-mono font-semibold">
                            {declCase.singular}
                          </span>
                          <span className="text-tint truncate font-mono font-semibold">
                            {declCase.plural}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

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
          </Card>
        ) : (
          <Card
            variant="inset"
            padding="none"
            className="text-label-secondary text-body flex min-h-[400px] flex-col items-center justify-center border-dashed p-8 text-center"
          >
            <BookOpen className="text-tint/40 mb-3 h-8 w-8" />
            <p className="font-semibold">No word selected</p>
            <p className="text-label-secondary text-footnote mt-1">
              Select a conlang vocabulary term from the left list to view script transcriptions,
              noun case declensions, and edit its lexical definition.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
