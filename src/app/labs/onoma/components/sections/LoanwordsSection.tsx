"use client";

// src/app/labs/onoma/components/sections/LoanwordsSection.tsx
// Onoma Lab — Loanword & Contact Registry Section

import { useState, useEffect } from "react";
import { Languages, Plus, Trash2, ArrowRightLeft } from "lucide-react";
import { CultureGameIcon } from "../nav/onoma-tabs";
import { FacetMaterial } from "~/components/ui/facet";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface SoundShift {
  from: string;
  to: string;
}

interface SourceWord {
  word: string;
  meaning: string;
}

const PRESET_WORDS: SourceWord[] = [
  { word: "phalanx", meaning: "military unit" },
  { word: "centaur", meaning: "mythical creature" },
  { word: "basilica", meaning: "large church" },
  { word: "emporium", meaning: "trading marketplace" },
  { word: "scholar", meaning: "academic student" },
];

export default function LoanwordsSection() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Selected contact state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Form states for contact entry
  const [sourcePackId, setSourcePackId] = useState("");
  const [targetPackId, setTargetPackId] = useState("");
  const [domain, setDomain] = useState("trade");
  const [intensity, setIntensity] = useState(0.3);

  // Phonetic adaptation rules
  const [soundShifts, setSoundShifts] = useState<SoundShift[]>([
    { from: "ph", to: "p" },
    { from: "c", to: "k" },
    { from: "x", to: "ks" },
  ]);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");

  const [codaDrop, setCodaDrop] = useState(false);
  const [vowelEpenthesis, setVowelEpenthesis] = useState(true);
  const [epentheticVowel, setEpentheticVowel] = useState("a");

  // Word simulation list
  const [testWords, setTestWords] = useState<SourceWord[]>(PRESET_WORDS);
  const [newTestWord, setNewTestWord] = useState("");
  const [newTestMeaning, setNewTestMeaning] = useState("");

  // Queries
  const { data: contacts, isLoading: contactsLoading } = api.onoma.listContacts.useQuery();
  const { data: packsData } = api.onoma.list.useQuery();

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
    } else {
      setSourcePackId("");
      setTargetPackId("");
      setDomain("trade");
      setIntensity(0.3);
      setSoundShifts([
        { from: "ph", to: "p" },
        { from: "c", to: "k" },
        { from: "x", to: "ks" },
      ]);
      setCodaDrop(false);
      setVowelEpenthesis(true);
      setEpentheticVowel("a");
    }
  }, [selectedContactId, contacts]);

  // Execute borrow simulation on changes
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

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFrom) return;
    setSoundShifts((prev) => [...prev, { from: newFrom, to: newTo }]);
    setNewFrom("");
    setNewTo("");
  };

  const handleRemoveShift = (idx: number) => {
    setSoundShifts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourcePackId || !targetPackId || sourcePackId === targetPackId) {
      notify.error("Please select two distinct conlang packs.");
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
    if (!newTestWord || !newTestMeaning) return;
    setTestWords((prev) => [...prev, { word: newTestWord, meaning: newTestMeaning }]);
    setNewTestWord("");
    setNewTestMeaning("");
  };

  const handleRemoveTestWord = (idx: number) => {
    setTestWords((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-foreground flex items-center gap-2 text-xl font-bold tracking-tight">
          <Languages className="h-5 w-5 text-emerald-500" />
          Loanword & Contact Registry
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Map contact history between conlangs and simulate vocabulary borrowing with phonetic
          adaptation rules.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Contact Links Registry */}
        <div className="space-y-4 lg:col-span-5">
          <FacetMaterial material="satin" className="border-border/20 space-y-4 border p-4">
            <div className="border-border/10 flex items-center justify-between border-b pb-2">
              <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
                Contact Registry Links
              </h3>
              <button
                onClick={() => setSelectedContactId(null)}
                className="cursor-pointer text-[10px] font-bold text-emerald-500 hover:text-emerald-400"
              >
                + New Contact
              </button>
            </div>

            {contactsLoading ? (
              <div className="text-muted-foreground text-xs">Loading contacts...</div>
            ) : contacts?.length === 0 ? (
              <div className="text-muted-foreground text-xs italic">
                No contact mappings created yet.
              </div>
            ) : (
              <div className="max-h-48 scrollbar-thin space-y-1.5 overflow-y-auto pr-1">
                {contacts?.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContactId(c.id)}
                    className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs transition-colors ${
                      selectedContactId === c.id
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "hover:bg-secondary/15 text-foreground border-transparent"
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{c.sourcePack.name}</span>
                      <span className="text-muted-foreground mx-2">→</span>
                      <span className="font-semibold">{c.targetPack.name}</span>
                    </div>
                    <span className="text-muted-foreground rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] capitalize">
                      {c.domain}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </FacetMaterial>

          {/* Form to configure Contact Registry */}
          <FacetMaterial material="satin" className="border-border/20 border p-4">
            <form onSubmit={handleSaveContact} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Contact Configuration
                </h4>
                {selectedContactId && (
                  <button
                    type="button"
                    onClick={() => deleteContactMutation.mutate({ id: selectedContactId })}
                    className="flex cursor-pointer items-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>

              {/* Source Conlang */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                    Source Conlang (L1)
                  </label>
                  <select
                    value={sourcePackId}
                    onChange={(e) => setSourcePackId(e.target.value)}
                    required
                    className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="">(Select Source)</option>
                    {packsData?.packs?.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                    Target Conlang (L2)
                  </label>
                  <select
                    value={targetPackId}
                    onChange={(e) => setTargetPackId(e.target.value)}
                    required
                    className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="">(Select Target)</option>
                    {packsData?.packs?.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Domain & Intensity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                    Contact Domain
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs"
                  >
                    <option value="trade">Trade & Commerce</option>
                    <option value="military">Military & War</option>
                    <option value="religious">Religion & Ritual</option>
                    <option value="academic">Academic & Sciences</option>
                    <option value="general">General Contact</option>
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                    Borrowing Intensity: {Math.round(intensity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="bg-secondary/50 mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg accent-emerald-500"
                  />
                </div>
              </div>

              {/* Adaptation Rules */}
              <div className="border-border/10 space-y-3 border-t pt-3">
                <h5 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Phonological Adaptation Rules
                </h5>

                {/* Syllable Coda Adaptations */}
                <div className="flex gap-4">
                  <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={codaDrop}
                      onChange={(e) => setCodaDrop(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Coda Drop (Drop final C)
                  </label>
                  <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={vowelEpenthesis}
                      onChange={(e) => setVowelEpenthesis(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Epenthesis (Add V)
                  </label>
                  {vowelEpenthesis && (
                    <input
                      type="text"
                      maxLength={1}
                      value={epentheticVowel}
                      onChange={(e) => setEpentheticVowel(e.target.value)}
                      placeholder="a"
                      className="bg-background/50 border-border/40 text-foreground w-8 rounded border text-center font-mono text-xs"
                    />
                  )}
                </div>

                {/* Sound Shift Builder */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="From (e.g. ph)"
                      value={newFrom}
                      onChange={(e) => setNewFrom(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground flex-1 rounded border px-2 py-1 font-mono text-xs"
                    />
                    <input
                      type="text"
                      placeholder="To (e.g. p)"
                      value={newTo}
                      onChange={(e) => setNewTo(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground flex-1 rounded border px-2 py-1 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddShift}
                      className="bg-secondary/40 hover:bg-secondary/60 text-foreground rounded px-3 py-1 text-xs font-bold"
                    >
                      Add Rule
                    </button>
                  </div>

                  <div className="flex max-h-24 scrollbar-thin flex-wrap gap-1.5 overflow-y-auto pr-1">
                    {soundShifts.map((shift, idx) => (
                      <span
                        key={idx}
                        className="bg-secondary/10 border-border/10 inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-xs"
                      >
                        {shift.from} → {shift.to || "∅"}
                        <button
                          type="button"
                          onClick={() => handleRemoveShift(idx)}
                          className="font-bold text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saveContactMutation.isPending}
                className="w-full cursor-pointer rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-700 active:scale-95"
              >
                Save Contact Configuration
              </button>
            </form>
          </FacetMaterial>
        </div>

        {/* Right Column: Loanword Adaptation Simulator Sandbox */}
        <div className="space-y-4 lg:col-span-7">
          <FacetMaterial material="satin" className="space-y-4 border border-emerald-500/20 p-4">
            <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <CultureGameIcon className="h-4.5 w-4.5 text-emerald-500" />
              Adaptation Simulator Sandbox
            </h3>

            {/* Simulated Words Output Grid */}
            <div className="border-border/15 overflow-hidden rounded-lg border bg-black/40">
              <div className="bg-secondary/15 text-muted-foreground border-border/10 grid grid-cols-12 gap-2 border-b px-4 py-2 text-[10px] font-bold tracking-wider uppercase">
                <span className="col-span-4">Source Word</span>
                <span className="col-span-4">Adaptation Rules</span>
                <span className="col-span-4">Adapted Loanword</span>
              </div>

              {borrowMutation.data?.results && borrowMutation.data.results.length > 0 ? (
                <div className="divide-border/5 max-h-72 scrollbar-thin divide-y overflow-y-auto pr-1">
                  {borrowMutation.data.results.map((res: any, idx: number) => (
                    <div
                      key={idx}
                      className="hover:bg-secondary/5 grid grid-cols-12 items-center gap-2 px-4 py-3 text-xs transition-colors"
                    >
                      <div className="col-span-4 flex flex-col">
                        <span className="text-foreground font-bold">{res.original}</span>
                        <span className="text-muted-foreground truncate text-[10px] italic">
                          {res.meaning}
                        </span>
                      </div>
                      <div className="text-muted-foreground col-span-4 flex flex-col gap-0.5 font-mono text-[10px]">
                        {soundShifts.some((s) => res.original.includes(s.from)) && (
                          <span className="text-emerald-400">✓ Sound Shifts applied</span>
                        )}
                        {codaDrop && <span className="text-amber-400">✓ Coda Dropped</span>}
                        {vowelEpenthesis && (
                          <span className="text-blue-400">✓ Epenthesis (+{epentheticVowel})</span>
                        )}
                      </div>
                      <div className="col-span-4 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-emerald-400">
                          {res.borrowed || res.original}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTestWord(idx)}
                          className="cursor-pointer p-1 text-xs text-red-400 opacity-0 transition-opacity hover:text-red-300 hover:opacity-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground p-8 text-center text-xs italic">
                  No source words added to simulate. Add some below.
                </div>
              )}
            </div>

            {/* Add Custom Word to Sandbox Form */}
            <form onSubmit={handleAddTestWord} className="border-border/10 space-y-3 border-t pt-4">
              <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                Add Source Word to Simulator
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Source Word (e.g. centaur)"
                  value={newTestWord}
                  onChange={(e) => setNewTestWord(e.target.value)}
                  className="bg-background/50 border-border/40 text-foreground rounded border px-2.5 py-1.5 text-xs focus:outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder="English Meaning"
                  value={newTestMeaning}
                  onChange={(e) => setNewTestMeaning(e.target.value)}
                  className="bg-background/50 border-border/40 text-foreground rounded border px-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded bg-emerald-600 py-1.5 text-xs font-bold text-white transition-all hover:bg-emerald-700 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" /> Add to Simulation
              </button>
            </form>
          </FacetMaterial>
        </div>
      </div>
    </div>
  );
}
