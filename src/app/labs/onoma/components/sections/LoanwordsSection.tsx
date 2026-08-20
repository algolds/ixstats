// src/app/labs/onoma/components/sections/LoanwordsSection.tsx
// Onoma Lab — Loanword & Contact Registry Section
// Philosophy: Historical Linguistics × Apple Design × Emil Design Engineering

"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Globe2,
  HelpCircle,
  X,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FacetMaterial } from "~/components/ui/facet";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";

import {
  THEMATIC_PRESETS,
  PHONETIC_LAW_PRESETS,
  type SoundShift,
  type SourceWord,
} from "~/lib/onoma/loanwords-presets";

export default function LoanwordsSection() {
  const notify = useNotify();
  const utils = api.useUtils();
  const shouldReduceMotion = useReducedMotion();
  const donorSelectRef = useRef<HTMLSelectElement | null>(null);

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
            <FacetMaterial
              material="satin"
              className="border-[#0091ff]/30 bg-[#0091ff]/5 space-y-2.5 rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#0091ff]" />
                  <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                    Loanwords & Historical Language Contact Guide
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(false)}
                  className="hover:bg-secondary/40 text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <div className="space-y-1">
                  <span className="text-foreground font-semibold">1. Contact Channels</span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Map relationships between Donor (L1) and Recipient (L2) languages across trade, warfare, or academic domains.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-foreground font-semibold">2. Phonetic Shifts</span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Loanwords mutate to match target phonology (e.g. Greek ⟨ph⟩ → Romance ⟨f⟩ or Grimm&apos;s Consonant Shift).
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-foreground font-semibold">3. Syllable Constraints</span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Use Coda Drop to strip illegal terminal consonants or Vowel Epenthesis (+V) to maintain open syllable harmony.
                  </p>
                </div>
              </div>
            </FacetMaterial>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Contact Links & Configuration (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Contact Registry List */}
          <FacetMaterial material="satin" className="border-border/30 space-y-3 rounded-2xl border p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0091ff]/10 text-[#0091ff]">
                  <Globe2 className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Contact Channels
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(!showHelpGuide)}
                  title="Toggle Contact Guide"
                  className={cn(
                    "flex h-6.5 w-6.5 items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95",
                    showHelpGuide
                      ? "border-[#0091ff]/40 bg-[#0091ff]/15 text-[#0091ff]"
                      : "border-border/40 bg-secondary/20 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNewChannel}
                  className="hover:border-[#0091ff]/40 hover:bg-[#0091ff]/10 border-border/40 bg-secondary/20 flex h-6.5 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-bold text-[#0091ff] transition-all cursor-pointer active:scale-[0.97]"
                >
                  <Plus className="h-3 w-3" />
                  <span>New Channel</span>
                </button>
              </div>
            </div>

            {contactsLoading ? (
              <div className="text-muted-foreground py-2 text-xs">Loading contact channels...</div>
            ) : !contacts || contacts.length === 0 ? (
              <div className="text-muted-foreground py-3 text-xs italic text-center">
                No active contact channels mapped yet. Click &quot;New Channel&quot; to begin.
              </div>
            ) : (
              <div className="max-h-44 scrollbar-thin space-y-1.5 overflow-y-auto pr-1">
                {contacts.map((c: any) => {
                  const isSelected = selectedContactId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedContactId(c.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-all cursor-pointer active:scale-[0.98]",
                        isSelected
                          ? "border-[#0091ff]/50 bg-[#0091ff]/10 text-[#0091ff] shadow-xs font-semibold"
                          : "border-border/30 bg-background/50 hover:bg-secondary/20 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold truncate">{c.sourcePack?.name}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-bold truncate">{c.targetPack?.name}</span>
                      </div>
                      <span className="text-muted-foreground bg-secondary/40 rounded px-1.5 py-0.5 text-[9px] font-mono capitalize shrink-0 ml-1">
                        {c.domain}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </FacetMaterial>

          {/* Form to configure Contact Registry */}
          <FacetMaterial material="satin" className="border-border/30 space-y-4 rounded-2xl border p-4 shadow-sm">
            <form onSubmit={handleSaveContact} className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                    Channel Settings
                  </h4>
                  {!selectedContactId && (
                    <span className="text-[#0091ff] bg-[#0091ff]/10 border border-[#0091ff]/30 rounded px-1.5 py-0.2 text-[9px] font-mono font-semibold">
                      New
                    </span>
                  )}
                </div>
                {selectedContactId && (
                  <button
                    type="button"
                    onClick={() => deleteContactMutation.mutate({ id: selectedContactId })}
                    className="text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer active:scale-[0.97]"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              {/* Source & Target Language Selectors */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Donor Language (L1)
                  </label>
                  <select
                    ref={donorSelectRef}
                    value={sourcePackId}
                    onChange={(e) => setSourcePackId(e.target.value)}
                    required
                    className="bg-background/80 border-border/40 text-foreground focus:border-[#0091ff]/60 w-full rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all outline-none"
                  >
                    <option value="">(Select Donor L1)</option>
                    {packsData?.packs?.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Recipient Language (L2)
                  </label>
                  <select
                    value={targetPackId}
                    onChange={(e) => setTargetPackId(e.target.value)}
                    required
                    className="bg-background/80 border-border/40 text-foreground focus:border-[#0091ff]/60 w-full rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all outline-none"
                  >
                    <option value="">(Select Recipient L2)</option>
                    {packsData?.packs?.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contact Domain & Intensity */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Contact Domain
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="bg-background/80 border-border/40 text-foreground focus:border-[#0091ff]/60 w-full rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-all outline-none"
                  >
                    <option value="trade">Trade & Commerce</option>
                    <option value="military">Military & Warfare</option>
                    <option value="religious">Religion & Ritual</option>
                    <option value="academic">Sciences & Academia</option>
                    <option value="general">General Cultural Exchange</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground font-bold tracking-wider uppercase">Intensity</span>
                    <span className="text-[#0091ff] font-mono font-bold bg-[#0091ff]/10 rounded px-1.5 py-0.2">
                      {Math.round(intensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="accent-[#0091ff] mt-1 h-1.5 w-full cursor-pointer rounded-lg bg-secondary/40"
                  />
                </div>
              </div>

              {/* Phonological Adaptation Rules Suite */}
              <div className="border-border/20 space-y-2.5 border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Phonetic Adaptation Rules
                  </span>
                  <div className="flex items-center gap-1">
                    {PHONETIC_LAW_PRESETS.map((law) => (
                      <button
                        key={law.name}
                        type="button"
                        onClick={() => handleApplyPhoneticLaw(law)}
                        title={law.description}
                        className="hover:border-[#0091ff]/40 hover:bg-[#0091ff]/10 border-border/30 bg-secondary/20 rounded-md border px-1.5 py-0.5 text-[9px] font-mono font-semibold transition-all cursor-pointer active:scale-95"
                      >
                        {law.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Syllable Coda & Epenthesis Controls */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/30 bg-secondary/15 p-2 text-xs">
                  <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={codaDrop}
                      onChange={(e) => setCodaDrop(e.target.checked)}
                      className="accent-[#0091ff] rounded"
                    />
                    <span>Coda Drop (Drop final C)</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs select-none">
                      <input
                        type="checkbox"
                        checked={vowelEpenthesis}
                        onChange={(e) => setVowelEpenthesis(e.target.checked)}
                        className="accent-[#0091ff] rounded"
                      />
                      <span>Epenthesis (+V)</span>
                    </label>

                    {vowelEpenthesis && (
                      <input
                        type="text"
                        maxLength={1}
                        value={epentheticVowel}
                        onChange={(e) => setEpentheticVowel(e.target.value)}
                        placeholder="a"
                        className="bg-background/80 border-border/40 text-foreground focus:border-[#0091ff]/60 h-6 w-7 rounded-md border text-center font-mono text-xs font-bold outline-none"
                      />
                    )}
                  </div>
                </div>

                {/* Sound Shift Builder Input Strip */}
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="From (e.g. ph)"
                      value={newFrom}
                      onChange={(e) => setNewFrom(e.target.value)}
                      className="bg-background/80 border-border/40 text-foreground placeholder:text-muted-foreground/60 focus:border-[#0091ff]/60 flex-1 rounded-xl border px-2.5 py-1.5 font-mono text-xs outline-none"
                    />
                    <span className="text-muted-foreground self-center">→</span>
                    <input
                      type="text"
                      placeholder="To (e.g. p)"
                      value={newTo}
                      onChange={(e) => setNewTo(e.target.value)}
                      className="bg-background/80 border-border/40 text-foreground placeholder:text-muted-foreground/60 focus:border-[#0091ff]/60 flex-1 rounded-xl border px-2.5 py-1.5 font-mono text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddShift}
                      disabled={!newFrom.trim()}
                      className="hover:border-[#0091ff]/40 bg-secondary/30 hover:bg-[#0091ff]/10 text-foreground rounded-xl border border-border/40 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-30"
                    >
                      Add
                    </button>
                  </div>

                  {/* Sound Shifts Active Pill Stream */}
                  <div className="flex max-h-20 scrollbar-thin flex-wrap gap-1.5 overflow-y-auto pr-1">
                    <AnimatePresence>
                      {soundShifts.map((shift, idx) => (
                        <motion.span
                          key={`${shift.from}-${shift.to}-${idx}`}
                          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-[#0091ff]/10 border-[#0091ff]/25 text-[#0091ff] inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-xs font-semibold"
                        >
                          {shift.from} → {shift.to || "∅"}
                          <button
                            type="button"
                            onClick={() => handleRemoveShift(idx)}
                            className="text-[#0091ff]/60 hover:text-rose-400 font-bold transition-colors cursor-pointer"
                          >
                            ×
                          </button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saveContactMutation.isPending}
                className="bg-[#0091ff] hover:bg-[#0080e6] disabled:opacity-40 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-white shadow-xs transition-all active:scale-[0.97]"
              >
                <span>{saveContactMutation.isPending ? "Saving Channel..." : "Save Contact Channel"}</span>
              </button>
            </form>
          </FacetMaterial>
        </div>

        {/* Right Column: Loanword Adaptation Simulator Sandbox (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <FacetMaterial material="satin" className="border-border/30 space-y-4 rounded-2xl border p-4 shadow-sm">
            {/* Simulator Header & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#0091ff]/10 text-[#0091ff]">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-foreground text-xs font-bold tracking-wider uppercase">
                    Adaptation Simulator
                  </h3>
                  <p className="text-muted-foreground text-[10px]">
                    Real-time phonological mutation & borrowing pipeline
                  </p>
                </div>
              </div>

              {/* Source Pack Sync & Presets Toolbar */}
              <div className="flex items-center gap-1.5">
                {sourcePack && (
                  <button
                    type="button"
                    onClick={handleSyncSourceLexicon}
                    title={`Sync lexicon words from ${sourcePack.name}`}
                    className="hover:border-[#0091ff]/40 hover:bg-[#0091ff]/10 border-border/40 bg-secondary/20 flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-bold text-[#0091ff] transition-all cursor-pointer active:scale-95"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Sync {sourcePack.name}</span>
                  </button>
                )}

                {/* Thematic Preset Selector */}
                <div className="flex items-center gap-0.5 rounded-xl border border-border/40 bg-secondary/20 p-0.5">
                  {Object.keys(THEMATIC_PRESETS).map((key) => {
                    const preset = THEMATIC_PRESETS[key];
                    const isSelected = activePresetKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setActivePresetKey(key);
                          setTestWords(preset.words);
                          notify.info(`Loaded ${preset.label} vocabulary.`);
                        }}
                        className={cn(
                          "rounded-lg px-2 py-1 text-[9px] font-semibold transition-all cursor-pointer active:scale-95",
                          isSelected
                            ? "bg-background text-foreground shadow-2xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {preset.label.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Simulated Words Output Table */}
            <div className="border-border/30 overflow-hidden rounded-xl border bg-background/50 dark:bg-card/20 shadow-inner">
              <div className="bg-secondary/20 text-muted-foreground border-border/20 grid grid-cols-12 gap-2 border-b px-4 py-2 text-[10px] font-bold tracking-wider uppercase select-none">
                <span className="col-span-4">Donor Word (L1)</span>
                <span className="col-span-4">Transformation Pipeline</span>
                <span className="col-span-4 text-right">Adapted Form (L2)</span>
              </div>

              {borrowMutation.data?.results && borrowMutation.data.results.length > 0 ? (
                <div className="divide-border/10 max-h-80 scrollbar-thin divide-y overflow-y-auto">
                  {borrowMutation.data.results.map((res: any, idx: number) => {
                    const isCopied = copiedIndex === idx;
                    const adaptedWord = res.borrowed || res.original;
                    return (
                      <div
                        key={idx}
                        className="hover:bg-secondary/15 group grid grid-cols-12 items-center gap-2 px-4 py-3 text-xs transition-colors"
                      >
                        {/* Column 1: Source Word & Meaning */}
                        <div className="col-span-4 flex flex-col">
                          <span className="text-foreground font-mono font-bold text-xs">{res.original}</span>
                          <span className="text-muted-foreground truncate text-[10px] italic">
                            {res.meaning}
                          </span>
                        </div>

                        {/* Column 2: Applied Rules Breakdown */}
                        <div className="col-span-4 flex flex-wrap gap-1 font-mono text-[9px]">
                          {soundShifts.some((s) => res.original.toLowerCase().includes(s.from)) && (
                            <span className="text-[#0091ff] bg-[#0091ff]/10 rounded px-1.5 py-0.2 font-semibold">
                              shift
                            </span>
                          )}
                          {codaDrop && (
                            <span className="text-amber-500 bg-amber-500/10 rounded px-1.5 py-0.2 font-semibold">
                              -coda
                            </span>
                          )}
                          {vowelEpenthesis && (
                            <span className="text-indigo-400 bg-indigo-500/10 rounded px-1.5 py-0.2 font-semibold">
                              +{epentheticVowel}
                            </span>
                          )}
                          {!soundShifts.some((s) => res.original.toLowerCase().includes(s.from)) &&
                            !codaDrop &&
                            !vowelEpenthesis && (
                              <span className="text-muted-foreground opacity-60">direct</span>
                            )}
                        </div>

                        {/* Column 3: Adapted Result & Actions */}
                        <div className="col-span-4 flex items-center justify-end gap-2">
                          <span className="text-sm font-extrabold font-mono text-[#0091ff] tracking-tight">
                            {adaptedWord}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => handleCopyWord(adaptedWord, idx)}
                              title="Copy adapted word"
                              className="hover:bg-secondary/60 text-muted-foreground hover:text-foreground rounded p-1 transition-colors cursor-pointer active:scale-90"
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveTestWord(idx)}
                              title="Remove word"
                              className="text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 rounded p-1 transition-colors cursor-pointer active:scale-90"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted-foreground p-8 text-center text-xs italic">
                  No source words active in simulator. Choose a preset above or add a word below.
                </div>
              )}
            </div>

            {/* Add Custom Word to Simulator Form */}
            <form onSubmit={handleAddTestWord} className="border-border/20 space-y-2.5 border-t pt-3.5">
              <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Add Custom Word to Simulator
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Source Word (e.g. centaur)"
                  value={newTestWord}
                  onChange={(e) => setNewTestWord(e.target.value)}
                  className="bg-background/80 border-border/40 text-foreground placeholder:text-muted-foreground/60 focus:border-[#0091ff]/60 flex-1 rounded-xl border px-3 py-1.5 font-mono text-xs outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder="Meaning / Gloss"
                  value={newTestMeaning}
                  onChange={(e) => setNewTestMeaning(e.target.value)}
                  className="bg-background/80 border-border/40 text-foreground placeholder:text-muted-foreground/60 focus:border-[#0091ff]/60 flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none"
                />
                <button
                  type="submit"
                  className="hover:border-[#0091ff]/40 bg-secondary/30 hover:bg-[#0091ff]/10 text-foreground rounded-xl border border-border/40 px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus className="inline h-3.5 w-3.5 mr-1 text-[#0091ff]" />
                  <span>Add Word</span>
                </button>
              </div>
            </form>
          </FacetMaterial>
        </div>
      </div>
    </div>
  );
}
