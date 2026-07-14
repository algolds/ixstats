"use client";

// src/app/labs/onoma/components/sections/LoanwordsSection.tsx
// Onoma Lab — Loanword & Contact Registry Section

import { useState, useEffect } from "react";
import { Languages, Plus, Trash2, ArrowRightLeft, Sparkles } from "lucide-react";
import { FacetMaterial } from "~/components/facet-ui";
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
        <h2 className="text-foreground text-xl font-bold tracking-tight flex items-center gap-2">
          <Languages className="h-5 w-5 text-emerald-500" />
          Loanword & Contact Registry
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Map contact history between conlangs and simulate vocabulary borrowing with phonetic adaptation rules.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Contact Links Registry */}
        <div className="lg:col-span-5 space-y-4">
          <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border/10">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
                Contact Registry Links
              </h3>
              <button
                onClick={() => setSelectedContactId(null)}
                className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold cursor-pointer"
              >
                + New Contact
              </button>
            </div>

            {contactsLoading ? (
              <div className="text-xs text-muted-foreground">Loading contacts...</div>
            ) : contacts?.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No contact mappings created yet.</div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {contacts?.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContactId(c.id)}
                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex justify-between items-center border ${
                      selectedContactId === c.id
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "hover:bg-secondary/15 border-transparent text-foreground"
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{c.sourcePack.name}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="font-semibold">{c.targetPack.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground capitalize bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {c.domain}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </FacetMaterial>

          {/* Form to configure Contact Registry */}
          <FacetMaterial material="satin" className="border border-border/20 p-4">
            <form onSubmit={handleSaveContact} className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Contact Configuration
                </h4>
                {selectedContactId && (
                  <button
                    type="button"
                    onClick={() => deleteContactMutation.mutate({ id: selectedContactId })}
                    className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>

              {/* Source Conlang */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Source Conlang (L1)</label>
                  <select
                    value={sourcePackId}
                    onChange={(e) => setSourcePackId(e.target.value)}
                    required
                    className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
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
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Target Conlang (L2)</label>
                  <select
                    value={targetPackId}
                    onChange={(e) => setTargetPackId(e.target.value)}
                    required
                    className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
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
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Contact Domain</label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs"
                  >
                    <option value="trade">Trade & Commerce</option>
                    <option value="military">Military & War</option>
                    <option value="religious">Religion & Ritual</option>
                    <option value="academic">Academic & Sciences</option>
                    <option value="general">General Contact</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">
                    Borrowing Intensity: {Math.round(intensity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-secondary/50 accent-emerald-500 mt-2"
                  />
                </div>
              </div>

              {/* Adaptation Rules */}
              <div className="border-t border-border/10 pt-3 space-y-3">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Phonological Adaptation Rules
                </h5>

                {/* Syllable Coda Adaptations */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={codaDrop}
                      onChange={(e) => setCodaDrop(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Coda Drop (Drop final C)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
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
                      className="w-8 text-center border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
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
                      className="flex-1 px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                    <input
                      type="text"
                      placeholder="To (e.g. p)"
                      value={newTo}
                      onChange={(e) => setNewTo(e.target.value)}
                      className="flex-1 px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddShift}
                      className="bg-secondary/40 hover:bg-secondary/60 text-foreground px-3 py-1 rounded text-xs font-bold"
                    >
                      Add Rule
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin">
                    {soundShifts.map((shift, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary/10 border border-border/10 text-xs font-mono"
                      >
                        {shift.from} → {shift.to || "∅"}
                        <button
                          type="button"
                          onClick={() => handleRemoveShift(idx)}
                          className="text-red-400 hover:text-red-300 font-bold"
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs cursor-pointer active:scale-95 transition-all"
              >
                Save Contact Configuration
              </button>
            </form>
          </FacetMaterial>
        </div>

        {/* Right Column: Loanword Adaptation Simulator Sandbox */}
        <div className="lg:col-span-7 space-y-4">
          <FacetMaterial material="satin" className="border border-emerald-500/20 p-4 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-emerald-500 animate-pulse" />
              Adaptation Simulator Sandbox
            </h3>

            {/* Simulated Words Output Grid */}
            <div className="border border-border/15 rounded-lg bg-black/40 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 bg-secondary/15 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/10">
                <span className="col-span-4">Source Word</span>
                <span className="col-span-4">Adaptation Rules</span>
                <span className="col-span-4">Adapted Loanword</span>
              </div>

              {borrowMutation.data?.results && borrowMutation.data.results.length > 0 ? (
                <div className="divide-y divide-border/5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {borrowMutation.data.results.map((res: any, idx: number) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 px-4 py-3 text-xs hover:bg-secondary/5 transition-colors items-center"
                    >
                      <div className="col-span-4 flex flex-col">
                        <span className="font-bold text-foreground">{res.original}</span>
                        <span className="text-[10px] text-muted-foreground italic truncate">
                          {res.meaning}
                        </span>
                      </div>
                      <div className="col-span-4 flex flex-col gap-0.5 text-[10px] text-muted-foreground font-mono">
                        {soundShifts.some((s) => res.original.includes(s.from)) && (
                          <span className="text-emerald-400">✓ Sound Shifts applied</span>
                        )}
                        {codaDrop && (
                          <span className="text-amber-400">✓ Coda Dropped</span>
                        )}
                        {vowelEpenthesis && (
                          <span className="text-blue-400">✓ Epenthesis (+{epentheticVowel})</span>
                        )}
                      </div>
                      <div className="col-span-4 flex justify-between items-center">
                        <span className="font-extrabold text-emerald-400 text-sm">
                          {res.borrowed || res.original}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTestWord(idx)}
                          className="text-red-400 hover:text-red-300 text-xs p-1 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  No source words added to simulate. Add some below.
                </div>
              )}
            </div>

            {/* Add Custom Word to Sandbox Form */}
            <form onSubmit={handleAddTestWord} className="border-t border-border/10 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Add Source Word to Simulator
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Source Word (e.g. centaur)"
                  value={newTestWord}
                  onChange={(e) => setNewTestWord(e.target.value)}
                  className="px-2.5 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder="English Meaning"
                  value={newTestMeaning}
                  onChange={(e) => setNewTestMeaning(e.target.value)}
                  className="px-2.5 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded text-xs cursor-pointer active:scale-95 transition-all"
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
