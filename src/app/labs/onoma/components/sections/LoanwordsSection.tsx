"use client";
// src/app/labs/onoma/components/sections/LoanwordsSection.tsx
// Onoma Lab — Loanword & Contact Registry Section
// Philosophy: Historical Linguistics × Apple Design × Emil Design Engineering

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Trash as Trash2,
  ArrowRight,
  Copy,
  Check,
  Refresh as RefreshCw,
  ControlSlider as Sliders,
  Globe as Globe2,
  HelpCircle,
  Xmark as X,
  OpenBook as BookOpen,
} from "iconoir-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

import {
  THEMATIC_PRESETS,
  PHONETIC_LAW_PRESETS,
  type SoundShift,
  type SourceWord,
} from "~/lib/onoma/loanwords-presets";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Toggle } from "~/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Slider } from "~/components/ui/slider";
import { Card } from "~/components/ui/card";

export default function LoanwordsSection() {
  const notify = useNotify();
  const utils = api.useUtils();
  const shouldReduceMotion = useReducedMotion();
  const donorSelectRef = useRef<HTMLButtonElement | null>(null);

  // Selected contact state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Form states for contact entry
  const [sourcePackId, setSourcePackId] = useState("");
  const [targetPackId, setTargetPackId] = useState("");
  const [domain, setDomain] = useState("trade");
  const [intensity, setIntensity] = useState(0.35);

  // Phonetic adaptation rules
  const [soundShifts, setSoundShifts] = useState<SoundShift[]>([
    { from: "ph", to: "f" },
    { from: "c", to: "k" },
    { from: "x", to: "ks" },
  ]);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");

  const [codaDrop, setCodaDrop] = useState(false);
  const [vowelEpenthesis, setVowelEpenthesis] = useState(true);
  const [epentheticVowel, setEpentheticVowel] = useState("a");

  // Word simulation list & active preset
  const [activePresetKey, setActivePresetKey] = useState<string>("trade");
  const [testWords, setTestWords] = useState<SourceWord[]>(THEMATIC_PRESETS.trade.words);
  const [newTestWord, setNewTestWord] = useState("");
  const [newTestMeaning, setNewTestMeaning] = useState("");

  // Feedback states
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Queries
  const { data: contacts, isLoading: contactsLoading } = api.onoma.listContacts.useQuery();
  const { data: packsData } = api.onoma.list.useQuery();

  // Selected source and target pack models
  const sourcePack = useMemo(
    () => packsData?.packs?.find((p: any) => p.id === sourcePackId),
    [packsData, sourcePackId]
  );

  // Mutations
  const saveContactMutation = api.onoma.saveContact.useMutation({
    onSuccess: (data: { id: string }) => {
      notify.success("Language contact registry saved.");
      setSelectedContactId(data.id);
      void utils.onoma.listContacts.invalidate();
    },
    onError: (err: { message: string }) => {
      notify.error(`Failed to save contact: ${err.message}`);
    },
  });

  const deleteContactMutation = api.onoma.deleteContact.useMutation({
    onSuccess: () => {
      notify.success("Language contact registry entry deleted.");
      setSelectedContactId(null);
      void utils.onoma.listContacts.invalidate();
    },
    onError: (err: { message: string }) => {
      notify.error(`Failed to delete contact: ${err.message}`);
    },
  });

  const borrowMutation = api.onoma.borrowWords.useMutation();

  // Sync state when contact is selected
  useEffect(() => {
    if (selectedContactId && contacts) {
      const c = contacts.find((item: any) => item.id === selectedContactId);
      if (c) {
        setSourcePackId(c.sourcePackId);
        setTargetPackId(c.targetPackId);
        setDomain(c.domain);
        setIntensity(c.intensity);

        const rules = (c.adaptationRules || {}) as {
          soundShifts?: SoundShift[];
          codaDrop?: boolean;
          vowelEpenthesis?: boolean;
          epentheticVowel?: string;
        };

        setSoundShifts(rules.soundShifts || []);
        setCodaDrop(!!rules.codaDrop);
        setVowelEpenthesis(!!rules.vowelEpenthesis);
        setEpentheticVowel(rules.epentheticVowel || "a");
      }
    }
  }, [selectedContactId, contacts]);

  // Execute borrow simulation on rule/word changes
  useEffect(() => {
    if (testWords.length > 0) {
      borrowMutation.mutate({
        sourceWords: testWords,
        soundShifts,
        codaDrop,
        vowelEpenthesis,
        epentheticVowel,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testWords, soundShifts, codaDrop, vowelEpenthesis, epentheticVowel]);

  // Dedicated Reset & Create New Channel Handler
  const handleNewChannel = () => {
    setSelectedContactId(null);
    setSourcePackId("");
    setTargetPackId("");
    setDomain("trade");
    setIntensity(0.35);
    setSoundShifts([
      { from: "ph", to: "f" },
      { from: "c", to: "k" },
      { from: "x", to: "ks" },
    ]);
    setCodaDrop(false);
    setVowelEpenthesis(true);
    setEpentheticVowel("a");
    notify.info("Drafting new contact channel. Select Donor and Recipient below.");
    setTimeout(() => {
      donorSelectRef.current?.focus();
    }, 60);
  };

  // 1-Click Sync from Source Language Pack's actual lexicon
  const handleSyncSourceLexicon = () => {
    if (!sourcePack) {
      notify.error("Select a source language pack first.");
      return;
    }

    const pack = sourcePack as { name: string; lexiconSeed?: unknown };
    const lexiconWords: string[] = Array.isArray(pack.lexiconSeed)
      ? (pack.lexiconSeed as string[])
      : [];

    if (lexiconWords.length === 0) {
      notify.info(`No custom lexicon words found in ${sourcePack.name}. Using domain preset.`);
      return;
    }

    const formatted: SourceWord[] = lexiconWords.slice(0, 10).map((w, i) => ({
      word: w,
      meaning: `derived term ${i + 1}`,
    }));

    setTestWords(formatted);
    notify.success(`Loaded ${formatted.length} words from ${sourcePack.name}`);
  };

  const handleApplyPhoneticLaw = (law: (typeof PHONETIC_LAW_PRESETS)[0]) => {
    setSoundShifts(law.shifts);
    notify.success(`Applied ${law.name} sound shift rules.`);
  };

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFrom.trim()) return;
    setSoundShifts((prev) => [
      ...prev,
      { from: newFrom.trim().toLowerCase(), to: newTo.trim().toLowerCase() },
    ]);
    setNewFrom("");
    setNewTo("");
  };

  const handleRemoveShift = (idx: number) => {
    setSoundShifts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourcePackId || !targetPackId || sourcePackId === targetPackId) {
      notify.error("Please select two distinct language packs.");
      return;
    }

    saveContactMutation.mutate({
      id: selectedContactId || undefined,
      sourcePackId,
      targetPackId,
      domain,
      intensity,
      adaptationRules: {
        soundShifts,
        codaDrop,
        vowelEpenthesis,
        epentheticVowel,
      },
    });
  };

  const handleAddTestWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestWord.trim() || !newTestMeaning.trim()) return;
    setTestWords((prev) => [
      ...prev,
      { word: newTestWord.trim().toLowerCase(), meaning: newTestMeaning.trim() },
    ]);
    setNewTestWord("");
    setNewTestMeaning("");
  };

  const handleRemoveTestWord = (idx: number) => {
    setTestWords((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCopyWord = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Help Guide Drawer Overlay */}
      <AnimatePresence>
        {showHelpGuide && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <Card variant="inset" padding="none" className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="text-tint h-4 w-4" />
                  <h4 className="text-label text-subhead">
                    Loanwords & Historical Language Contact Guide
                  </h4>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowHelpGuide(false)}
                  aria-label="Close guide"
                  className="text-label-secondary hover:text-label"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-footnote grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <span className="text-label font-semibold">1. Contact Channels</span>
                  <p className="text-label-secondary text-caption leading-relaxed">
                    Map relationships between Donor (L1) and Recipient (L2) languages across trade,
                    warfare, or academic domains.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-label font-semibold">2. Phonetic Shifts</span>
                  <p className="text-label-secondary text-caption leading-relaxed">
                    Loanwords mutate to match target phonology (e.g. Greek ⟨ph⟩ → Romance ⟨f⟩ or
                    Grimm&apos;s Consonant Shift).
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-label font-semibold">3. Syllable Constraints</span>
                  <p className="text-label-secondary text-caption leading-relaxed">
                    Use Coda Drop to strip illegal terminal consonants or Vowel Epenthesis (+V) to
                    maintain open syllable harmony.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Contact Links & Configuration (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Contact Registry List */}
          <Card variant="inset" padding="none" className="space-y-3 p-4">
            <div className="border-separator flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <div className="bg-tint/10 text-tint rounded-control flex h-6 w-6 items-center justify-center">
                  <Globe2 className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-label text-subhead">Contact Channels</h3>
              </div>
              <div className="flex items-center gap-2">
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={showHelpGuide}
                  onPressedChange={setShowHelpGuide}
                  title="Toggle Contact Guide"
                  aria-label="Contact guide"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </Toggle>
                <Button variant="secondary" size="sm" onClick={handleNewChannel}>
                  <Plus className="h-3 w-3" />
                  <span>New Channel</span>
                </Button>
              </div>
            </div>

            {contactsLoading ? (
              <div className="text-label-secondary text-footnote py-2">
                Loading contact channels...
              </div>
            ) : !contacts || contacts.length === 0 ? (
              <div className="text-label-secondary text-footnote py-3 text-center italic">
                No active contact channels mapped yet. Click &quot;New Channel&quot; to begin.
              </div>
            ) : (
              <FacetListSection
                variant="plain"
                aria-label="Contact channels"
                groupClassName="max-h-44 overflow-y-auto"
              >
                {contacts.map((c: any) => (
                  <FacetRow
                    key={c.id}
                    onClick={() => setSelectedContactId(c.id)}
                    selected={selectedContactId === c.id}
                    selectionStyle="tint"
                    title={
                      <span className="text-footnote flex items-center gap-2 truncate font-semibold">
                        <span className="truncate">{c.sourcePack?.name}</span>
                        <ArrowRight
                          aria-label="to"
                          className="text-label-secondary size-3 shrink-0"
                        />
                        <span className="truncate">{c.targetPack?.name}</span>
                      </span>
                    }
                    trailing={
                      <Badge variant="neutral" className="font-mono capitalize">
                        {c.domain}
                      </Badge>
                    }
                  />
                ))}
              </FacetListSection>
            )}
          </Card>

          {/* Form to configure Contact Registry */}
          <Card variant="inset" padding="none" className="space-y-4 p-4">
            <form onSubmit={handleSaveContact} className="space-y-4">
              <div className="border-separator flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-label text-subhead">Channel Settings</h4>
                  {!selectedContactId && (
                    <span className="text-tint bg-tint/10 border-tint/30 py-0.2 rounded-control-sm text-caption border px-2 font-mono font-semibold">
                      New
                    </span>
                  )}
                </div>
                {selectedContactId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteContactMutation.mutate({ id: selectedContactId })}
                    className="text-label-secondary hover:text-red text-label-secondary hover:text-red hover:bg-red/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </Button>
                )}
              </div>

              {/* Source & Target Language Selectors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-label-secondary text-subhead mb-1 block">
                    Donor Language (L1)
                  </label>
                  <Select value={sourcePackId} onValueChange={setSourcePackId} required>
                    <SelectTrigger size="sm" ref={donorSelectRef} className="w-full">
                      <SelectValue placeholder="(Select Donor L1)" />
                    </SelectTrigger>
                    <SelectContent>
                      {packsData?.packs?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-label-secondary text-subhead mb-1 block">
                    Recipient Language (L2)
                  </label>
                  <Select value={targetPackId} onValueChange={setTargetPackId} required>
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue placeholder="(Select Recipient L2)" />
                    </SelectTrigger>
                    <SelectContent>
                      {packsData?.packs?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contact Domain & Intensity */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-label-secondary text-subhead mb-1 block">
                    Contact Domain
                  </label>
                  <Select value={domain} onValueChange={(v) => setDomain(v)}>
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trade">Trade & Commerce</SelectItem>
                      <SelectItem value="military">Military & Warfare</SelectItem>
                      <SelectItem value="religious">Religion & Ritual</SelectItem>
                      <SelectItem value="academic">Sciences & Academia</SelectItem>
                      <SelectItem value="general">General Cultural Exchange</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-caption flex items-center justify-between">
                    <span className="text-label-secondary font-semibold uppercase">Intensity</span>
                    <span className="text-tint bg-tint/10 py-0.2 rounded-control-sm px-2 font-mono font-semibold">
                      {Math.round(intensity * 100)}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[Number(intensity)]}
                    onValueChange={([v = 0]) => setIntensity(v)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Phonological Adaptation Rules Suite */}
              <div className="border-separator space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-label-secondary text-eyebrow">
                    Phonetic Adaptation Rules
                  </span>
                  <div className="flex items-center gap-1">
                    {PHONETIC_LAW_PRESETS.map((law) => (
                      <Button
                        variant="outline"
                        size="sm"
                        key={law.name}
                        onClick={() => handleApplyPhoneticLaw(law)}
                        title={law.description}
                        className="font-mono"
                      >
                        {law.name.split(" ")[0]}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Syllable Coda & Epenthesis Controls */}
                <div className="border-separator bg-fill-4 rounded-row text-footnote flex flex-wrap items-center gap-3 border p-2">
                  <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-2 select-none">
                    <Checkbox
                      checked={codaDrop}
                      onCheckedChange={(checked) => setCodaDrop(checked === true)}
                    />
                    <span>Coda Drop (Drop final C)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <label className="text-label-secondary text-footnote flex cursor-pointer items-center gap-2 select-none">
                      <Checkbox
                        checked={vowelEpenthesis}
                        onCheckedChange={(checked) => setVowelEpenthesis(checked === true)}
                      />
                      <span>Epenthesis (+V)</span>
                    </label>

                    {vowelEpenthesis && (
                      <Input
                        type="text"
                        maxLength={1}
                        value={epentheticVowel}
                        onChange={(e) => setEpentheticVowel(e.target.value)}
                        placeholder="a"
                        className="text-footnote h-6 w-7 text-center font-mono"
                      />
                    )}
                  </div>
                </div>

                {/* Sound Shift Builder Input Strip */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="From (e.g. ph)"
                      value={newFrom}
                      onChange={(e) => setNewFrom(e.target.value)}
                      className="text-footnote flex-1 font-mono"
                    />
                    <span className="text-label-secondary self-center">→</span>
                    <Input
                      type="text"
                      placeholder="To (e.g. p)"
                      value={newTo}
                      onChange={(e) => setNewTo(e.target.value)}
                      className="text-footnote flex-1 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={handleAddShift}
                      disabled={!newFrom.trim()}
                    >
                      Add
                    </Button>
                  </div>

                  {/* Sound Shifts Active Pill Stream */}
                  <div className="flex max-h-20 scrollbar-thin flex-wrap gap-2 overflow-y-auto pr-1">
                    <AnimatePresence>
                      {soundShifts.map((shift, idx) => (
                        <motion.span
                          key={`${shift.from}-${shift.to}-${idx}`}
                          initial={
                            shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }
                          }
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-tint/10 border-tint/25 text-tint rounded-control text-footnote inline-flex items-center gap-2 border px-2 py-0.5 font-mono font-semibold"
                        >
                          {shift.from} → {shift.to || "∅"}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveShift(idx)}
                            aria-label="Remove shift"
                            className="text-tint/60 hover:text-red text-tint/60 hover:text-red"
                          >
                            ×
                          </Button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                type="submit"
                disabled={saveContactMutation.isPending}
                className="w-full justify-center"
              >
                <span>
                  {saveContactMutation.isPending ? "Saving Channel..." : "Save Contact Channel"}
                </span>
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Loanword Adaptation Simulator Sandbox (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <Card variant="inset" padding="none" className="space-y-4 p-4">
            {/* Simulator Header & Action Toolbar */}
            <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-tint/10 text-tint rounded-row flex h-7 w-7 items-center justify-center">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-label text-subhead">Adaptation Simulator</h3>
                  <p className="text-label-secondary text-caption">
                    Real-time phonological mutation & borrowing pipeline
                  </p>
                </div>
              </div>

              {/* Source Pack Sync & Presets Toolbar */}
              <div className="flex items-center gap-2">
                {sourcePack && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSyncSourceLexicon}
                    title={`Sync lexicon words from ${sourcePack.name}`}
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Sync {sourcePack.name}</span>
                  </Button>
                )}

                {/* Thematic Preset Selector */}
                <ToggleGroup
                  type="single"
                  size="sm"
                  disallowEmpty
                  aria-label="Thematic vocabulary preset"
                  value={activePresetKey}
                >
                  {Object.keys(THEMATIC_PRESETS).map((key) => {
                    const preset = THEMATIC_PRESETS[key];
                    // A click always (re)loads the preset's words, even when it is already active.
                    return (
                      <ToggleGroupItem
                        key={key}
                        value={key}
                        onClick={() => {
                          setActivePresetKey(key);
                          setTestWords(preset.words);
                          notify.info(`Loaded ${preset.label} vocabulary.`);
                        }}
                      >
                        {preset.label.split(" ")[0]}
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
              </div>
            </div>

            {/* Simulated Words Output Table */}
            <div className="border-separator bg-surface rounded-row overflow-hidden border shadow-inner">
              <div className="bg-fill-4 text-label-secondary border-separator text-eyebrow grid grid-cols-12 gap-2 border-b px-4 py-2 select-none">
                <span className="col-span-4">Donor Word (L1)</span>
                <span className="col-span-4">Transformation Pipeline</span>
                <span className="col-span-4 text-right">Adapted Form (L2)</span>
              </div>

              {borrowMutation.data?.results && borrowMutation.data.results.length > 0 ? (
                <div className="divide-separator max-h-80 scrollbar-thin divide-y overflow-y-auto">
                  {borrowMutation.data.results.map((res: any, idx: number) => {
                    const isCopied = copiedIndex === idx;
                    const adaptedWord = res.borrowed || res.original;
                    return (
                      <div
                        key={idx}
                        className="hover:bg-fill-4 group text-footnote grid grid-cols-12 items-center gap-2 px-4 py-3 transition-colors"
                      >
                        {/* Column 1: Source Word & Meaning */}
                        <div className="col-span-4 flex flex-col">
                          <span className="text-label text-footnote font-mono font-semibold">
                            {res.original}
                          </span>
                          <span className="text-label-secondary text-caption truncate italic">
                            {res.meaning}
                          </span>
                        </div>

                        {/* Column 2: Applied Rules Breakdown */}
                        <div className="text-caption col-span-4 flex flex-wrap gap-1 font-mono">
                          {soundShifts.some((s) => res.original.toLowerCase().includes(s.from)) && (
                            <span className="text-tint bg-tint/10 py-0.2 rounded-control-sm px-2 font-semibold">
                              shift
                            </span>
                          )}
                          {codaDrop && (
                            <span className="py-0.2 rounded-control-sm bg-yellow/10 text-yellow px-2 font-semibold">
                              -coda
                            </span>
                          )}
                          {vowelEpenthesis && (
                            <span className="py-0.2 rounded-control-sm bg-indigo/10 text-indigo px-2 font-semibold">
                              +{epentheticVowel}
                            </span>
                          )}
                          {!soundShifts.some((s) => res.original.toLowerCase().includes(s.from)) &&
                            !codaDrop &&
                            !vowelEpenthesis && (
                              <span className="text-label-secondary opacity-60">direct</span>
                            )}
                        </div>

                        {/* Column 3: Adapted Result & Actions */}
                        <div className="col-span-4 flex items-center justify-end gap-2">
                          <span className="text-tint text-body font-mono font-semibold">
                            {adaptedWord}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleCopyWord(adaptedWord, idx)}
                              title="Copy adapted word"
                              aria-label="Copy adapted word"
                              className="text-label-secondary hover:text-label"
                            >
                              {isCopied ? (
                                <Check className="text-green h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleRemoveTestWord(idx)}
                              title="Remove word"
                              aria-label="Remove word"
                              className="text-label-secondary hover:text-red hover:bg-red/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-label-secondary text-footnote p-8 text-center italic">
                  No source words active in simulator. Choose a preset above or add a word below.
                </div>
              )}
            </div>

            {/* Add Custom Word to Simulator Form */}
            <form onSubmit={handleAddTestWord} className="border-separator space-y-2 border-t pt-4">
              <h4 className="text-label-secondary text-subhead">Add Custom Word to Simulator</h4>
              <div className="flex gap-2">
                <Input
                  type="text"
                  required
                  placeholder="Source Word (e.g. centaur)"
                  value={newTestWord}
                  onChange={(e) => setNewTestWord(e.target.value)}
                  className="text-footnote flex-1 font-mono"
                />
                <Input
                  type="text"
                  required
                  placeholder="Meaning / Gloss"
                  value={newTestMeaning}
                  onChange={(e) => setNewTestMeaning(e.target.value)}
                  className="text-footnote flex-1"
                />
                <Button variant="outline" size="sm" type="submit" className="shrink-0">
                  <Plus className="text-tint mr-1 inline h-3.5 w-3.5" />
                  <span>Add Word</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
