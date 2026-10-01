"use client";

// src/app/labs/onoma/components/sections/syntax/SyntaxSentenceBuilder.tsx
// Sentence generator and live translation preview engine

import React from "react";
import { Cpu, ArrowRight } from "iconoir-react";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";

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
  const subjectPhrase = inflectNoun(
    subject,
    true,
    subjectPlural,
    subjectDefinite,
    subjectAdjective
  );
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
    <FacetCard variant="inset" padding="none" className="space-y-4 p-5 text-left">
      <h4 className="text-label text-subhead flex items-center gap-2">
        <Cpu className="text-indigo h-4 w-4" /> Live Sentence Generator
      </h4>

      {/* Translation Output Banner */}
      <div className="rounded-control border-indigo/20 bg-indigo/5 space-y-2 border p-4">
        <div className="text-label-secondary text-footnote flex items-center gap-2 font-semibold">
          <span>Source (English):</span>
          <span className="text-label italic">{englishSentence}</span>
        </div>
        <div className="text-label text-body flex items-center gap-2 font-semibold">
          <ArrowRight className="text-indigo h-4 w-4" />
          <span className="text-body text-indigo font-mono">{sentence}.</span>
        </div>
      </div>

      {/* Interactive Phrase Tuning */}
      <div className="text-footnote grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
        {/* Subject */}
        <div className="border-separator bg-fill-4 rounded-control space-y-2 border p-3">
          <span className="text-label block font-semibold">Subject Noun</span>
          <Input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full"
            placeholder="e.g. dog"
          />
          <Input
            type="text"
            value={subjectAdjective}
            onChange={(e) => setSubjectAdjective(e.target.value)}
            className="w-full"
            placeholder="Adjective (e.g. quick)"
          />
          <div className="text-label-secondary text-caption flex justify-between">
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={subjectPlural}
                onChange={(e) => setSubjectPlural(e.target.checked)}
                className="accent-indigo"
              />{" "}
              Plural
            </label>
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={subjectDefinite}
                onChange={(e) => setSubjectDefinite(e.target.checked)}
                className="accent-indigo"
              />{" "}
              Definite
            </label>
          </div>
        </div>

        {/* Verb */}
        <div className="border-separator bg-fill-4 rounded-control space-y-2 border p-3">
          <span className="text-label block font-semibold">Action Verb</span>
          <Input
            type="text"
            value={verb}
            onChange={(e) => setVerb(e.target.value)}
            className="w-full"
            placeholder="e.g. eat"
          />
          <select
            value={verbTense}
            onChange={(e) => setVerbTense(e.target.value)}
            className="border-separator bg-fill-3 text-label hover:bg-fill-2 focus-visible:outline-tint rounded-control-sm text-footnote h-(--control-height-sm) w-full border px-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <option value="present">Present Tense</option>
            <option value="past">Past Tense</option>
            <option value="future">Future Tense</option>
          </select>
        </div>

        {/* Object */}
        <div className="border-separator bg-fill-4 rounded-control space-y-2 border p-3">
          <span className="text-label block font-semibold">Object Noun</span>
          <Input
            type="text"
            value={object}
            onChange={(e) => setObject(e.target.value)}
            className="w-full"
            placeholder="e.g. fish"
          />
          <Input
            type="text"
            value={objectAdjective}
            onChange={(e) => setObjectAdjective(e.target.value)}
            className="w-full"
            placeholder="Adjective (e.g. small)"
          />
          <div className="text-label-secondary text-caption flex justify-between">
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={objectPlural}
                onChange={(e) => setObjectPlural(e.target.checked)}
                className="accent-indigo"
              />{" "}
              Plural
            </label>
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={objectDefinite}
                onChange={(e) => setObjectDefinite(e.target.checked)}
                className="accent-indigo"
              />{" "}
              Definite
            </label>
          </div>
        </div>
      </div>
    </FacetCard>
  );
}
