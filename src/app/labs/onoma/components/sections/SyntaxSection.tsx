"use client";

// src/app/labs/onoma/components/sections/SyntaxSection.tsx
// Onoma Lab — Syntax & Sentence Builder Section

import React, { useState, useEffect } from "react";
// oxlint-disable-next-line eslint/no-unused-vars
import { Trash as Trash2, Page as FileText } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SyntaxSentenceBuilder } from "./syntax/SyntaxSentenceBuilder";
import { SyntaxDictionaryEditor } from "./syntax/SyntaxDictionaryEditor";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";

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
      <Card variant="inset" padding="none" className="space-y-4 p-5 text-left">
        <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Grammar Profile Name (e.g. Imperial High Latinate)"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="text-footnote w-64"
            />
            {profiles && profiles.length > 0 && (
              <Select
                value={selectedProfileId || "" || "__none__"}
                onValueChange={(v) => setSelectedProfileId((v === "__none__" ? "" : v) || null)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Load Existing Profile...</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.wordOrder})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedProfileId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteProfileMutation.mutate({ id: selectedProfileId })}
                className="text-red text-red hover:bg-red/10"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saveProfileMutation.isPending}>
              {saveProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>

        {/* Word Order & Morphosyntax Grid */}
        <div className="text-footnote grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Word Order */}
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Word order</label>
            <Select value={wordOrder} onValueChange={(v) => setWordOrder(v)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SVO">SVO (English, Romance)</SelectItem>
                <SelectItem value="SOV">SOV (Japanese, Latin, Turkish)</SelectItem>
                <SelectItem value="VSO">VSO (Irish, Arabic)</SelectItem>
                <SelectItem value="VOS">VOS (Malagasy)</SelectItem>
                <SelectItem value="OVS">OVS (Hixkaryana)</SelectItem>
                <SelectItem value="OSV">OSV (Xavante)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Adjective Placement */}
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Adjective order</label>
            <Select value={adjectiveOrder} onValueChange={(v) => setAdjectiveOrder(v)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before Noun (Red apple)</SelectItem>
                <SelectItem value="after">After Noun (Apple red)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Accusative Suffix */}
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Accusative suffix</label>
            <Input
              type="text"
              value={accSuffix}
              onChange={(e) => setAccSuffix(e.target.value)}
              placeholder="e.g. -m, -on"
              className="w-full font-mono"
            />
          </div>

          {/* Plural Suffix */}
          <div className="space-y-1">
            <label className="text-label-secondary text-subhead">Plural suffix</label>
            <Input
              type="text"
              value={pluralSuffix}
              onChange={(e) => setPluralSuffix(e.target.value)}
              placeholder="e.g. -s, -n, -i"
              className="w-full font-mono"
            />
          </div>
        </div>
      </Card>

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
