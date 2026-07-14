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
          Define case systems, verb conjugations, and word orders, then watch them compile in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Profiles & Rule Configuration */}
        <div className="lg:col-span-5 space-y-4">
          <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border/10">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-amber-500" />
                Grammar Profiles
              </h3>
              <button
                onClick={() => setSelectedProfileId(null)}
                className="text-[10px] text-amber-500 hover:text-amber-400 font-bold cursor-pointer"
              >
                + New Profile
              </button>
            </div>

            {listLoading ? (
              <div className="text-xs text-muted-foreground">Loading profiles...</div>
            ) : profiles?.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No profiles saved yet. Use form below to save.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profiles?.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    className={`px-3 py-1.5 rounded text-xs transition-colors border ${
                      selectedProfileId === p.id
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "hover:bg-secondary/15 border-transparent text-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </FacetMaterial>

          {/* Configuration Form */}
          <FacetMaterial material="satin" className="border border-border/20 p-4">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Profile Settings
                </h4>
                {selectedProfileId && (
                  <button
                    type="button"
                    onClick={() => deleteProfileMutation.mutate({ id: selectedProfileId })}
                    className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground font-medium mb-1">Profile Name</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Basic Word Order / Adjective Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Clause Word Order</label>
                  <select
                    value={wordOrder}
                    onChange={(e) => setWordOrder(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
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
                  <label className="block text-[10px] text-muted-foreground font-medium mb-1">Adjective Order</label>
                  <select
                    value={adjectiveOrder}
                    onChange={(e) => setAdjectiveOrder(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded bg-background/50 border-border/40 text-foreground text-xs focus:outline-none"
                  >
                    <option value="before">Before Noun (quick dog)</option>
                    <option value="after">After Noun (dog quick)</option>
                  </select>
                </div>
              </div>

              {/* Case System */}
              <div className="border-t border-border/10 pt-3 space-y-2">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Case Suffixes
                </h5>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Nominative (Subj)</label>
                    <input
                      type="text"
                      value={nomSuffix}
                      onChange={(e) => setNomSuffix(e.target.value)}
                      placeholder="none"
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Accusative (Obj)</label>
                    <input
                      type="text"
                      value={accSuffix}
                      onChange={(e) => setAccSuffix(e.target.value)}
                      placeholder="-m"
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Genitive (Poss)</label>
                    <input
                      type="text"
                      value={genSuffix}
                      onChange={(e) => setGenSuffix(e.target.value)}
                      placeholder="-s"
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Verb Tenses */}
              <div className="border-t border-border/10 pt-3 space-y-2">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Verb Conjugation Suffixes
                </h5>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Past Tense</label>
                    <input
                      type="text"
                      value={pastSuffix}
                      onChange={(e) => setPastSuffix(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Present Tense</label>
                    <input
                      type="text"
                      value={presSuffix}
                      onChange={(e) => setPresSuffix(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Future Tense</label>
                    <input
                      type="text"
                      value={futSuffix}
                      onChange={(e) => setFutSuffix(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Articles & Numbers */}
              <div className="border-t border-border/10 pt-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Def. Article ("the")</label>
                    <input
                      type="text"
                      value={defArticle}
                      onChange={(e) => setDefArticle(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Indef. Article ("a")</label>
                    <input
                      type="text"
                      value={indefArticle}
                      onChange={(e) => setIndefArticle(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Plural Marker</label>
                    <input
                      type="text"
                      value={pluralSuffix}
                      onChange={(e) => setPluralSuffix(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saveProfileMutation.isPending}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-xs cursor-pointer active:scale-95 transition-all"
              >
                Save Grammar Profile
              </button>
            </form>
          </FacetMaterial>
        </div>

        {/* Right Column: Sentence Builder Workspace */}
        <div className="lg:col-span-7 space-y-4">
          <FacetMaterial material="satin" className="border border-amber-500/20 p-4 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4 text-amber-500 animate-pulse" />
              Live Sentence Compiler Workspace
            </h3>

            {/* Translation Output Box */}
            <div className="p-4 rounded-lg bg-black/40 border border-border/10 space-y-2">
              <span className="text-[10px] text-muted-foreground font-mono uppercase">Compiled Output:</span>
              <div className="text-lg font-bold text-amber-400 min-h-8">
                {compileMutation.data?.compiledText || "..."}
              </div>
            </div>

            {/* Compilation Steps */}
            {compileMutation.data?.steps && (
              <div className="space-y-1 bg-secondary/5 p-3 border border-border/5 rounded text-[11px] text-muted-foreground font-mono">
                <div className="font-bold text-foreground mb-1">Compilation Steps:</div>
                {compileMutation.data.steps.map((step: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <ArrowRight className="h-3 w-3 text-amber-500" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Phrase Config Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/10 pt-4">
              {/* Subject Phrase */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Subject Phrase</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Noun</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
                    >
                      {Object.keys(dictionary).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Adjective</label>
                    <select
                      value={subjectAdjective}
                      onChange={(e) => setSubjectAdjective(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
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
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={subjectPlural}
                      onChange={(e) => setSubjectPlural(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Plural Subject
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
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
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Action & Object</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Verb</label>
                    <select
                      value={verb}
                      onChange={(e) => setVerb(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
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
                    <label className="block text-[9px] text-muted-foreground">Tense</label>
                    <select
                      value={verbTense}
                      onChange={(e) => setVerbTense(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
                    >
                      <option value="present">Present Tense</option>
                      <option value="past">Past Tense</option>
                      <option value="future">Future Tense</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[9px] text-muted-foreground">Direct Object</label>
                    <select
                      value={object}
                      onChange={(e) => setObject(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
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
                    <label className="block text-[9px] text-muted-foreground">Object Adjective</label>
                    <select
                      value={objectAdjective}
                      onChange={(e) => setObjectAdjective(e.target.value)}
                      className="w-full px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
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
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={objectPlural}
                      onChange={(e) => setObjectPlural(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Plural Object
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
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
          <FacetMaterial material="satin" className="border border-border/20 p-4 space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Translation Dictionary
            </h3>

            <form onSubmit={handleAddToDict} className="grid grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={newDictKey}
                onChange={(e) => setNewDictKey(e.target.value)}
                placeholder="English (e.g. wolf)"
                className="px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
              />
              <input
                type="text"
                required
                value={newDictVal}
                onChange={(e) => setNewDictVal(e.target.value)}
                placeholder="Conlang translation"
                className="px-2 py-1 border rounded bg-background/50 border-border/40 text-foreground text-xs"
              />
              <button
                type="submit"
                className="bg-secondary/35 hover:bg-secondary/50 text-foreground text-xs font-bold rounded cursor-pointer"
              >
                Add Translation
              </button>
            </form>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
              {Object.entries(dictionary).map(([key, val]) => (
                <div
                  key={key}
                  className="flex justify-between items-center px-2 py-1 rounded bg-secondary/10 border border-border/5 text-xs"
                >
                  <span className="font-mono text-muted-foreground truncate mr-1">
                    {key} <span className="text-[10px] text-amber-500">→</span> {val}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromDict(key)}
                    className="text-red-400 hover:text-red-300 text-[10px]"
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
