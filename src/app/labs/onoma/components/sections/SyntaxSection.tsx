"use client";

// src/app/labs/onoma/components/sections/SyntaxSection.tsx
// Onoma Lab — Syntax & Sentence Builder Section

import { useState, useEffect } from "react";
import { SlidersHorizontal, Trash2, Cpu, FileText, ArrowRight } from "lucide-react";
import { FacetMaterial } from "~/components/facet-ui";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

const INITIAL_DICTIONARY = {
  dog: "koba",
  cat: "miao",
  fish: "ika",
  quick: "felo",
  small: "piko",
  eat: "muna",
  see: "viza",
  love: "ama",
};

export default function SyntaxSection() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Selected profile state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Profile Form States
  const [profileName, setProfileName] = useState("");
  const [wordOrder, setWordOrder] = useState("SVO");
  const [adjectiveOrder, setAdjectiveOrder] = useState("before");

  // Case Suffixes
  const [nomSuffix, setNomSuffix] = useState("");
  const [accSuffix, setAccSuffix] = useState("m");
  const [genSuffix, setGenSuffix] = useState("s");

  // Verb Conjugations
  const [pastSuffix, setPastSuffix] = useState("ed");
  const [presSuffix, setPresSuffix] = useState("s");
  const [futSuffix, setFutSuffix] = useState("lo");

  // Articles
  const [defArticle, setDefArticle] = useState("te");
  const [indefArticle, setIndefArticle] = useState("un");

  // Number Suffixes
  const [pluralSuffix, setPluralSuffix] = useState("n");

  // Dictionary State
  const [dictionary, setDictionary] = useState<Record<string, string>>(INITIAL_DICTIONARY);
  const [newDictKey, setNewDictKey] = useState("");
  const [newDictVal, setNewDictVal] = useState("");

  // Sentence Builder State
  const [subject, setSubject] = useState("dog");
  const [subjectPlural, setSubjectPlural] = useState(false);
  const [subjectDefinite, setSubjectDefinite] = useState(true);
  const [subjectAdjective, setSubjectAdjective] = useState("quick");

  const [verb, setVerb] = useState("eat");
  const [verbTense, setVerbTense] = useState("present");

  const [object, setObject] = useState("fish");
  const [objectPlural, setObjectPlural] = useState(false);
  const [objectDefinite, setObjectDefinite] = useState(false);
  const [objectAdjective, setObjectAdjective] = useState("small");

  // Queries
  const { data: profiles, isLoading: listLoading } = api.onoma.listProfiles.useQuery();

  // Mutations
  const saveProfileMutation = api.onoma.saveProfile.useMutation({
    onSuccess: (data: any) => {
      notify.success(`Profile '${data.name}' saved.`);
      setSelectedProfileId(data.id);
      void utils.onoma.listProfiles.invalidate();
    },
    onError: (err: any) => {
      notify.error(`Failed to save profile: ${err.message}`);
    },
  });

  const deleteProfileMutation = api.onoma.deleteProfile.useMutation({
    onSuccess: () => {
      notify.success("Grammar profile deleted.");
      setSelectedProfileId(null);
      void utils.onoma.listProfiles.invalidate();
    },
    onError: (err: any) => {
      notify.error(`Failed to delete profile: ${err.message}`);
    },
  });

  // Automatically update form fields when selected profile changes
  useEffect(() => {
    if (selectedProfileId && profiles) {
      const p = profiles.find((p: any) => p.id === selectedProfileId);
      if (p) {
        setProfileName(p.name);
        setWordOrder(p.wordOrder);
        setAdjectiveOrder(p.adjectiveOrder);

        const cases = (p.caseSystem || {}) as Record<string, string>;
        setNomSuffix(cases.nominative || "");
        setAccSuffix(cases.accusative || "");
        setGenSuffix(cases.genitive || "");

        const verbs = (p.verbConjugation || {}) as Record<string, string>;
        setPastSuffix(verbs.past || "");
        setPresSuffix(verbs.present || "");
        setFutSuffix(verbs.future || "");

        const arts = (p.articles || {}) as Record<string, string>;
        setDefArticle(arts.definite || "");
        setIndefArticle(arts.indefinite || "");

        const nums = (p.numberSystem || {}) as Record<string, string>;
        setPluralSuffix(nums.plural || "");
      }
    } else {
      // Clear forms
      setProfileName("New Grammar Profile");
      setWordOrder("SVO");
      setAdjectiveOrder("before");
      setNomSuffix("");
      setAccSuffix("m");
      setGenSuffix("s");
      setPastSuffix("ed");
      setPresSuffix("s");
      setFutSuffix("lo");
      setDefArticle("te");
      setIndefArticle("un");
      setPluralSuffix("n");
    }
  }, [selectedProfileId, profiles]);

  // Sentence Compilation Query (we can simulate this locally or call the mutation)
  const compileMutation = api.onoma.compileAndTranslate.useMutation();

  const handleCompile = () => {
    const rawProfile = {
      wordOrder,
      caseSystem: { nominative: nomSuffix, accusative: accSuffix, genitive: genSuffix },
      verbConjugation: { past: pastSuffix, present: presSuffix, future: futSuffix },
      articles: { definite: defArticle, indefinite: indefArticle },
      numberSystem: { plural: pluralSuffix },
      adjectiveOrder,
    };

    const sentence = {
      subject,
      subjectPlural,
      subjectDefinite,
      subjectAdjectives: subjectAdjective ? [subjectAdjective] : [],
      verb: verb || undefined,
      verbTense,
      object: object || undefined,
      objectPlural,
      objectDefinite,
      objectAdjectives: objectAdjective ? [objectAdjective] : [],
    };

    compileMutation.mutate({
      profile: rawProfile,
      sentence,
      dictionary,
    });
  };

  // Compile automatically on parameter change
  useEffect(() => {
    handleCompile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wordOrder,
    adjectiveOrder,
    nomSuffix,
    accSuffix,
    genSuffix,
    pastSuffix,
    presSuffix,
    futSuffix,
    defArticle,
    indefArticle,
    pluralSuffix,
    subject,
    subjectPlural,
    subjectDefinite,
    subjectAdjective,
    verb,
    verbTense,
    object,
    objectPlural,
    objectDefinite,
    objectAdjective,
    dictionary,
  ]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName) return;

    saveProfileMutation.mutate({
      id: selectedProfileId || undefined,
      name: profileName,
      wordOrder,
      adjectiveOrder,
      caseSystem: { nominative: nomSuffix, accusative: accSuffix, genitive: genSuffix },
      verbConjugation: { past: pastSuffix, present: presSuffix, future: futSuffix },
      articles: { definite: defArticle, indefinite: indefArticle },
      numberSystem: { plural: pluralSuffix },
    });
  };

  const handleAddToDict = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDictKey || !newDictVal) return;
    setDictionary((prev) => ({
      ...prev,
      [newDictKey.toLowerCase().trim()]: newDictVal.trim(),
    }));
    setNewDictKey("");
    setNewDictVal("");
  };

  const handleRemoveFromDict = (key: string) => {
    setDictionary((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-foreground text-xl font-bold tracking-tight">
          Syntax & Sentence Builder
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Define case systems, verb conjugations, and word orders, then watch them compile in
          real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Profiles & Rule Configuration */}
        <div className="space-y-4 lg:col-span-5">
          <FacetMaterial material="satin" className="border-border/20 space-y-4 border p-4">
            <div className="border-border/10 flex items-center justify-between border-b pb-2">
              <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                <SlidersHorizontal className="h-4 w-4 text-amber-500" />
                Grammar Profiles
              </h3>
              <button
                onClick={() => setSelectedProfileId(null)}
                className="cursor-pointer text-[10px] font-bold text-amber-500 hover:text-amber-400"
              >
                + New Profile
              </button>
            </div>

            {listLoading ? (
              <div className="text-muted-foreground text-xs">Loading profiles...</div>
            ) : profiles?.length === 0 ? (
              <div className="text-muted-foreground text-xs italic">
                No profiles saved yet. Use form below to save.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profiles?.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                      selectedProfileId === p.id
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "hover:bg-secondary/15 text-foreground border-transparent"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </FacetMaterial>

          {/* Configuration Form */}
          <FacetMaterial material="satin" className="border-border/20 border p-4">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Profile Settings
                </h4>
                {selectedProfileId && (
                  <button
                    type="button"
                    onClick={() => deleteProfileMutation.mutate({ id: selectedProfileId })}
                    className="flex cursor-pointer items-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>

              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                  Profile Name
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              {/* Basic Word Order / Adjective Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                    Clause Word Order
                  </label>
                  <select
                    value={wordOrder}
                    onChange={(e) => setWordOrder(e.target.value)}
                    className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="SVO">SVO (e.g. English)</option>
                    <option value="SOV">SOV (e.g. Japanese)</option>
                    <option value="VSO">VSO (e.g. Arabic)</option>
                    <option value="VOS">VOS (e.g. Malagasy)</option>
                    <option value="OVS">OVS (e.g. Klingon)</option>
                    <option value="OSV">OSV (e.g. Warao)</option>
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-[10px] font-medium">
                    Adjective Order
                  </label>
                  <select
                    value={adjectiveOrder}
                    onChange={(e) => setAdjectiveOrder(e.target.value)}
                    className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="before">Before Noun (quick dog)</option>
                    <option value="after">After Noun (dog quick)</option>
                  </select>
                </div>
              </div>

              {/* Case System */}
              <div className="border-border/10 space-y-2 border-t pt-3">
                <h5 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Case Suffixes
                </h5>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-muted-foreground block text-[9px]">
                      Nominative (Subj)
                    </label>
                    <input
                      type="text"
                      value={nomSuffix}
                      onChange={(e) => setNomSuffix(e.target.value)}
                      placeholder="none"
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-[9px]">
                      Accusative (Obj)
                    </label>
                    <input
                      type="text"
                      value={accSuffix}
                      onChange={(e) => setAccSuffix(e.target.value)}
                      placeholder="-m"
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-[9px]">
                      Genitive (Poss)
                    </label>
                    <input
                      type="text"
                      value={genSuffix}
                      onChange={(e) => setGenSuffix(e.target.value)}
                      placeholder="-s"
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Verb Tenses */}
              <div className="border-border/10 space-y-2 border-t pt-3">
                <h5 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Verb Conjugation Suffixes
                </h5>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-muted-foreground block text-[9px]">Past Tense</label>
                    <input
                      type="text"
                      value={pastSuffix}
                      onChange={(e) => setPastSuffix(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-[9px]">Present Tense</label>
                    <input
                      type="text"
                      value={presSuffix}
                      onChange={(e) => setPresSuffix(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-[9px]">Future Tense</label>
                    <input
                      type="text"
                      value={futSuffix}
                      onChange={(e) => setFutSuffix(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Articles & Numbers */}
              <div className="border-border/10 space-y-2 border-t pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-muted-foreground block text-[9px]">
                      Def. Article ("the")
                    </label>
                    <input
                      type="text"
                      value={defArticle}
                      onChange={(e) => setDefArticle(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-[9px]">
                      Indef. Article ("a")
                    </label>
                    <input
                      type="text"
                      value={indefArticle}
                      onChange={(e) => setIndefArticle(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-[9px]">Plural Marker</label>
                    <input
                      type="text"
                      value={pluralSuffix}
                      onChange={(e) => setPluralSuffix(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saveProfileMutation.isPending}
                className="w-full cursor-pointer rounded-lg bg-amber-500 py-2 text-xs font-bold text-white transition-all hover:bg-amber-600 active:scale-95"
              >
                Save Grammar Profile
              </button>
            </form>
          </FacetMaterial>
        </div>

        {/* Right Column: Sentence Builder Workspace */}
        <div className="space-y-4 lg:col-span-7">
          <FacetMaterial material="satin" className="space-y-4 border border-amber-500/20 p-4">
            <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
              <Cpu className="h-4 w-4 animate-pulse text-amber-500" />
              Live Sentence Compiler Workspace
            </h3>

            {/* Translation Output Box */}
            <div className="border-border/10 space-y-2 rounded-lg border bg-black/40 p-4">
              <span className="text-muted-foreground font-mono text-[10px] uppercase">
                Compiled Output:
              </span>
              <div className="min-h-8 text-lg font-bold text-amber-400">
                {compileMutation.data?.compiledText || "..."}
              </div>
            </div>

            {/* Compilation Steps */}
            {compileMutation.data?.steps && (
              <div className="bg-secondary/5 border-border/5 text-muted-foreground space-y-1 rounded border p-3 font-mono text-[11px]">
                <div className="text-foreground mb-1 font-bold">Compilation Steps:</div>
                {compileMutation.data.steps.map((step: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <ArrowRight className="h-3 w-3 text-amber-500" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Phrase Config Controls */}
            <div className="border-border/10 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
              {/* Subject Phrase */}
              <div className="space-y-2">
                <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Subject Phrase
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block text-[9px]">Noun</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 text-xs"
                    >
                      {Object.keys(dictionary).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-[9px]">Adjective</label>
                    <select
                      value={subjectAdjective}
                      onChange={(e) => setSubjectAdjective(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 text-xs"
                    >
                      <option value="">(None)</option>
                      {Object.keys(dictionary).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-1">
                  <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={subjectPlural}
                      onChange={(e) => setSubjectPlural(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Plural Subject
                  </label>
                  <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={subjectDefinite}
                      onChange={(e) => setSubjectDefinite(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Definite ("the")
                  </label>
                </div>
              </div>

              {/* Verb & Object Phrase */}
              <div className="space-y-2">
                <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Action & Object
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block text-[9px]">Verb</label>
                    <select
                      value={verb}
                      onChange={(e) => setVerb(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 text-xs"
                    >
                      <option value="">(Intransitive - No Verb)</option>
                      {Object.keys(dictionary).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-[9px]">Tense</label>
                    <select
                      value={verbTense}
                      onChange={(e) => setVerbTense(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 text-xs"
                    >
                      <option value="present">Present Tense</option>
                      <option value="past">Past Tense</option>
                      <option value="future">Future Tense</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-muted-foreground block text-[9px]">Direct Object</label>
                    <select
                      value={object}
                      onChange={(e) => setObject(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 text-xs"
                    >
                      <option value="">(None)</option>
                      {Object.keys(dictionary).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground block text-[9px]">
                      Object Adjective
                    </label>
                    <select
                      value={objectAdjective}
                      onChange={(e) => setObjectAdjective(e.target.value)}
                      className="bg-background/50 border-border/40 text-foreground w-full rounded border px-2 py-1 text-xs"
                    >
                      <option value="">(None)</option>
                      {Object.keys(dictionary).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-1">
                  <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={objectPlural}
                      onChange={(e) => setObjectPlural(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Plural Object
                  </label>
                  <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={objectDefinite}
                      onChange={(e) => setObjectDefinite(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Definite ("the")
                  </label>
                </div>
              </div>
            </div>
          </FacetMaterial>

          {/* Lexicon Dictionary */}
          <FacetMaterial material="satin" className="border-border/20 space-y-4 border p-4">
            <h3 className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
              <FileText className="text-muted-foreground h-4 w-4" />
              Translation Dictionary
            </h3>

            <form onSubmit={handleAddToDict} className="grid grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={newDictKey}
                onChange={(e) => setNewDictKey(e.target.value)}
                placeholder="English (e.g. wolf)"
                className="bg-background/50 border-border/40 text-foreground rounded border px-2 py-1 text-xs"
              />
              <input
                type="text"
                required
                value={newDictVal}
                onChange={(e) => setNewDictVal(e.target.value)}
                placeholder="Conlang translation"
                className="bg-background/50 border-border/40 text-foreground rounded border px-2 py-1 text-xs"
              />
              <button
                type="submit"
                className="bg-secondary/35 hover:bg-secondary/50 text-foreground cursor-pointer rounded text-xs font-bold"
              >
                Add Translation
              </button>
            </form>

            <div className="grid max-h-36 scrollbar-thin grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid-cols-4">
              {Object.entries(dictionary).map(([key, val]) => (
                <div
                  key={key}
                  className="bg-secondary/10 border-border/5 flex items-center justify-between rounded border px-2 py-1 text-xs"
                >
                  <span className="text-muted-foreground mr-1 truncate font-mono">
                    {key} <span className="text-[10px] text-amber-500">→</span> {val}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromDict(key)}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </FacetMaterial>
        </div>
      </div>
    </div>
  );
}
