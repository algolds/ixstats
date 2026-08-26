"use client";

// src/app/labs/onoma/components/sections/syntax/SyntaxSentenceBuilder.tsx
// Sentence generator and live translation preview engine

import React from "react";
import { Cpu, ArrowRight } from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";

interface SyntaxSentenceBuilderProps {
  wordOrder: string;
  adjectiveOrder: string;
  nomSuffix: string;
  accSuffix: string;
  pastSuffix: string;
  presSuffix: string;
  futSuffix: string;
  defArticle: string;
  indefArticle: string;
  pluralSuffix: string;
  dictionary: Record<string, string>;
  subject: string;
  setSubject: (s: string) => void;
  subjectPlural: boolean;
  setSubjectPlural: (p: boolean) => void;
  subjectDefinite: boolean;
  setSubjectDefinite: (d: boolean) => void;
  subjectAdjective: string;
  setSubjectAdjective: (a: string) => void;
  verb: string;
  setVerb: (v: string) => void;
  verbTense: string;
  setVerbTense: (t: string) => void;
  object: string;
  setObject: (o: string) => void;
  objectPlural: boolean;
  setObjectPlural: (p: boolean) => void;
  objectDefinite: boolean;
  setObjectDefinite: (d: boolean) => void;
  objectAdjective: string;
  setObjectAdjective: (a: string) => void;
}

export function SyntaxSentenceBuilder({
  wordOrder,
  adjectiveOrder,
  nomSuffix,
  accSuffix,
  pastSuffix,
  presSuffix,
  futSuffix,
  defArticle,
  indefArticle,
  pluralSuffix,
  dictionary,
  subject,
  setSubject,
  subjectPlural,
  setSubjectPlural,
  subjectDefinite,
  setSubjectDefinite,
  subjectAdjective,
  setSubjectAdjective,
  verb,
  setVerb,
  verbTense,
  setVerbTense,
  object,
  setObject,
  objectPlural,
  setObjectPlural,
  objectDefinite,
  setObjectDefinite,
  objectAdjective,
  setObjectAdjective,
}: SyntaxSentenceBuilderProps) {
  // Translate & inflect words
  const inflectNoun = (
    baseEnglish: string,
    isSubject: boolean,
    isPlural: boolean,
    isDefinite: boolean,
    adjEnglish?: string
  ) => {
    const baseConlang = dictionary[baseEnglish] || baseEnglish;
    const caseEnd = isSubject ? nomSuffix : accSuffix;
    const numEnd = isPlural ? pluralSuffix : "";
    const art = isDefinite ? defArticle : indefArticle;

    const adjConlang = adjEnglish ? dictionary[adjEnglish] || adjEnglish : "";

    let nounPhrase = `${baseConlang}${numEnd}${caseEnd}`;
    if (adjConlang) {
      nounPhrase =
        adjectiveOrder === "before" ? `${adjConlang} ${nounPhrase}` : `${nounPhrase} ${adjConlang}`;
    }

    if (art) {
      nounPhrase = `${art} ${nounPhrase}`;
    }

    return nounPhrase.trim();
  };

  const inflectVerb = (baseEnglish: string, tense: string) => {
    const baseConlang = dictionary[baseEnglish] || baseEnglish;
    let tenseEnd = presSuffix;
    if (tense === "past") tenseEnd = pastSuffix;
    if (tense === "future") tenseEnd = futSuffix;
    return `${baseConlang}${tenseEnd}`;
  };

  // Build the translated sentence
  const subjectPhrase = inflectNoun(subject, true, subjectPlural, subjectDefinite, subjectAdjective);
  const verbPhrase = inflectVerb(verb, verbTense);
  const objectPhrase = inflectNoun(object, false, objectPlural, objectDefinite, objectAdjective);

  let sentence = "";
  if (wordOrder === "SVO") sentence = `${subjectPhrase} ${verbPhrase} ${objectPhrase}`;
  else if (wordOrder === "SOV") sentence = `${subjectPhrase} ${objectPhrase} ${verbPhrase}`;
  else if (wordOrder === "VSO") sentence = `${verbPhrase} ${subjectPhrase} ${objectPhrase}`;
  else if (wordOrder === "VOS") sentence = `${verbPhrase} ${objectPhrase} ${subjectPhrase}`;
  else if (wordOrder === "OVS") sentence = `${objectPhrase} ${verbPhrase} ${subjectPhrase}`;
  else if (wordOrder === "OSV") sentence = `${objectPhrase} ${subjectPhrase} ${verbPhrase}`;

  // English source sentence
  const engSubjArt = subjectDefinite ? "The" : "A";
  const engSubjAdj = subjectAdjective ? `${subjectAdjective} ` : "";
  const engSubjNoun = subjectPlural ? `${subject}s` : subject;

  let engVerb = verb;
  if (verbTense === "past") engVerb = `${verb}ed`;
  if (verbTense === "present" && !subjectPlural) engVerb = `${verb}s`;
  if (verbTense === "future") engVerb = `will ${verb}`;

  const engObjArt = objectDefinite ? "the" : "a";
  const engObjAdj = objectAdjective ? `${objectAdjective} ` : "";
  const engObjNoun = objectPlural ? `${object}s` : object;

  const englishSentence = `${engSubjArt} ${engSubjAdj}${engSubjNoun} ${engVerb} ${engObjArt} ${engObjAdj}${engObjNoun}.`;

  return (
    <FacetMaterial material="satin" className="rounded-xl border border-border/40 p-5 shadow-sm space-y-4 text-left">
      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
        <Cpu className="h-4 w-4 text-fuchsia-500" /> Live Sentence Generator
      </h4>

      {/* Translation Output Banner */}
      <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
          <span>Source (English):</span>
          <span className="text-foreground italic">{englishSentence}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <ArrowRight className="h-4 w-4 text-fuchsia-500" />
          <span className="font-mono text-fuchsia-500 text-base">{sentence}.</span>
        </div>
      </div>

      {/* Interactive Phrase Tuning */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
        {/* Subject */}
        <div className="space-y-2 rounded-lg border border-border/40 p-3 bg-secondary/10">
          <span className="font-bold text-foreground block">Subject Noun</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded border border-border/60 bg-background px-2 py-1 focus:outline-none"
            placeholder="e.g. dog"
          />
          <input
            type="text"
            value={subjectAdjective}
            onChange={(e) => setSubjectAdjective(e.target.value)}
            className="w-full rounded border border-border/60 bg-background px-2 py-1 focus:outline-none"
            placeholder="Adjective (e.g. quick)"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={subjectPlural}
                onChange={(e) => setSubjectPlural(e.target.checked)}
                className="accent-fuchsia-500"
              />{" "}
              Plural
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={subjectDefinite}
                onChange={(e) => setSubjectDefinite(e.target.checked)}
                className="accent-fuchsia-500"
              />{" "}
              Definite
            </label>
          </div>
        </div>

        {/* Verb */}
        <div className="space-y-2 rounded-lg border border-border/40 p-3 bg-secondary/10">
          <span className="font-bold text-foreground block">Action Verb</span>
          <input
            type="text"
            value={verb}
            onChange={(e) => setVerb(e.target.value)}
            className="w-full rounded border border-border/60 bg-background px-2 py-1 focus:outline-none"
            placeholder="e.g. eat"
          />
          <select
            value={verbTense}
            onChange={(e) => setVerbTense(e.target.value)}
            className="w-full rounded border border-border/60 bg-background px-2 py-1 focus:outline-none text-xs"
          >
            <option value="present">Present Tense</option>
            <option value="past">Past Tense</option>
            <option value="future">Future Tense</option>
          </select>
        </div>

        {/* Object */}
        <div className="space-y-2 rounded-lg border border-border/40 p-3 bg-secondary/10">
          <span className="font-bold text-foreground block">Object Noun</span>
          <input
            type="text"
            value={object}
            onChange={(e) => setObject(e.target.value)}
            className="w-full rounded border border-border/60 bg-background px-2 py-1 focus:outline-none"
            placeholder="e.g. fish"
          />
          <input
            type="text"
            value={objectAdjective}
            onChange={(e) => setObjectAdjective(e.target.value)}
            className="w-full rounded border border-border/60 bg-background px-2 py-1 focus:outline-none"
            placeholder="Adjective (e.g. small)"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={objectPlural}
                onChange={(e) => setObjectPlural(e.target.checked)}
                className="accent-fuchsia-500"
              />{" "}
              Plural
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={objectDefinite}
                onChange={(e) => setObjectDefinite(e.target.checked)}
                className="accent-fuchsia-500"
              />{" "}
              Definite
            </label>
          </div>
        </div>
      </div>
    </FacetMaterial>
  );
}
