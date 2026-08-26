"use client";

// src/app/labs/onoma/components/sections/SyntaxSection.tsx
// Onoma Lab — Syntax & Sentence Builder Section

import React, { useState, useEffect } from "react";
import { Trash as Trash2, Page as FileText } from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SyntaxSentenceBuilder } from "./syntax/SyntaxSentenceBuilder";
import { SyntaxDictionaryEditor } from "./syntax/SyntaxDictionaryEditor";

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
  const { data: profiles } = api.onoma.listProfiles.useQuery();

  // Mutations
  const saveProfileMutation = api.onoma.saveProfile.useMutation({
    onSuccess: (data) => {
      notify.success(`Profile '${data.name}' saved.`);
      setSelectedProfileId(data.id);
      void utils.onoma.listProfiles.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to save profile: ${err.message}`);
    },
  });

  const deleteProfileMutation = api.onoma.deleteProfile.useMutation({
    onSuccess: () => {
      notify.success("Grammar profile deleted.");
      setSelectedProfileId(null);
      void utils.onoma.listProfiles.invalidate();
    },
    onError: (err) => {
      notify.error(`Failed to delete profile: ${err.message}`);
    },
  });

  // Automatically update form fields when selected profile changes
  useEffect(() => {
    if (selectedProfileId && profiles) {
      const p = profiles.find((item) => item.id === selectedProfileId);
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
        setPluralSuffix(nums.plural || "n");
      }
    }
  }, [selectedProfileId, profiles]);

  const handleSave = () => {
    if (!profileName.trim()) {
      notify.error("Please provide a name for this grammar profile.");
      return;
    }
    saveProfileMutation.mutate({
      id: selectedProfileId || undefined,
      name: profileName,
      wordOrder,
      adjectiveOrder,
      caseSystem: {
        nominative: nomSuffix,
        accusative: accSuffix,
        genitive: genSuffix,
      },
      verbConjugation: {
        past: pastSuffix,
        present: presSuffix,
        future: futSuffix,
      },
      articles: {
        definite: defArticle,
        indefinite: indefArticle,
      },
      numberSystem: {
        plural: pluralSuffix,
      },
    });
  };

  const handleAddWord = (key: string, val: string) => {
    setDictionary((prev) => ({ ...prev, [key]: val }));
    notify.success(`Added '${key}' → '${val}'`);
  };

  const handleRemoveWord = (key: string) => {
    setDictionary((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Grammar Rules Formulation Card */}
      <FacetMaterial material="satin" className="rounded-xl border border-border/40 p-5 shadow-sm space-y-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Grammar Profile Name (e.g. Imperial High Latinate)"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none w-64"
            />
            {profiles && profiles.length > 0 && (
              <select
                value={selectedProfileId || ""}
                onChange={(e) => setSelectedProfileId(e.target.value || null)}
                className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none"
              >
                <option value="">Load Existing Profile...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.wordOrder})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedProfileId && (
              <button
                onClick={() => deleteProfileMutation.mutate({ id: selectedProfileId })}
                className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/20 cursor-pointer active:scale-[0.97] transition-all"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saveProfileMutation.isPending}
              className="rounded-md bg-onoma-primary px-3.5 py-1 text-xs font-bold text-white shadow hover:bg-onoma-primary-active transition-all cursor-pointer active:scale-[0.97] disabled:opacity-50"
            >
              {saveProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        {/* Word Order & Morphosyntax Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Word Order */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Word Order</label>
            <select
              value={wordOrder}
              onChange={(e) => setWordOrder(e.target.value)}
              className="w-full rounded border border-border/60 bg-background px-2 py-1.5 focus:outline-none"
            >
              <option value="SVO">SVO (English, Romance)</option>
              <option value="SOV">SOV (Japanese, Latin, Turkish)</option>
              <option value="VSO">VSO (Irish, Arabic)</option>
              <option value="VOS">VOS (Malagasy)</option>
              <option value="OVS">OVS (Hixkaryana)</option>
              <option value="OSV">OSV (Xavante)</option>
            </select>
          </div>

          {/* Adjective Placement */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Adjective Order</label>
            <select
              value={adjectiveOrder}
              onChange={(e) => setAdjectiveOrder(e.target.value)}
              className="w-full rounded border border-border/60 bg-background px-2 py-1.5 focus:outline-none"
            >
              <option value="before">Before Noun (Red apple)</option>
              <option value="after">After Noun (Apple red)</option>
            </select>
          </div>

          {/* Accusative Suffix */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Accusative Suffix</label>
            <input
              type="text"
              value={accSuffix}
              onChange={(e) => setAccSuffix(e.target.value)}
              placeholder="e.g. -m, -on"
              className="w-full rounded border border-border/60 bg-background px-2 py-1.5 focus:outline-none font-mono"
            />
          </div>

          {/* Plural Suffix */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Plural Suffix</label>
            <input
              type="text"
              value={pluralSuffix}
              onChange={(e) => setPluralSuffix(e.target.value)}
              placeholder="e.g. -s, -n, -i"
              className="w-full rounded border border-border/60 bg-background px-2 py-1.5 focus:outline-none font-mono"
            />
          </div>
        </div>
      </FacetMaterial>

      {/* Live Sentence Builder */}
      <SyntaxSentenceBuilder
        wordOrder={wordOrder}
        adjectiveOrder={adjectiveOrder}
        nomSuffix={nomSuffix}
        accSuffix={accSuffix}
        pastSuffix={pastSuffix}
        presSuffix={presSuffix}
        futSuffix={futSuffix}
        defArticle={defArticle}
        indefArticle={indefArticle}
        pluralSuffix={pluralSuffix}
        dictionary={dictionary}
        subject={subject}
        setSubject={setSubject}
        subjectPlural={subjectPlural}
        setSubjectPlural={setSubjectPlural}
        subjectDefinite={subjectDefinite}
        setSubjectDefinite={setSubjectDefinite}
        subjectAdjective={subjectAdjective}
        setSubjectAdjective={setSubjectAdjective}
        verb={verb}
        setVerb={setVerb}
        verbTense={verbTense}
        setVerbTense={setVerbTense}
        object={object}
        setObject={setObject}
        objectPlural={objectPlural}
        setObjectPlural={setObjectPlural}
        objectDefinite={objectDefinite}
        setObjectDefinite={setObjectDefinite}
        objectAdjective={objectAdjective}
        setObjectAdjective={setObjectAdjective}
      />

      {/* Dictionary Editor */}
      <SyntaxDictionaryEditor
        dictionary={dictionary}
        onAddWord={handleAddWord}
        onRemoveWord={handleRemoveWord}
      />
    </div>
  );
}
