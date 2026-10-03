"use client";

// src/app/labs/onoma/components/sections/LexiconExplorer.tsx
// Onoma Lab — Lexicon Analytics & Health Dashboard

import React, { useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Trophy as Award,
  WarningTriangle as AlertTriangle,
  Component as Layers,
  StatsReport as BarChart3,
} from "iconoir-react";
import {
  getLetterFrequencies,
  getNgramFrequencies,
  calculateEntropy,
  auditLexiconHealth,
} from "~/lib/onoma/lexicon-analytics";
import { Card } from "~/components/ui/card";

interface LexiconExplorerProps {
  words: string[];
}

export function LexiconExplorer({ words }: LexiconExplorerProps) {
  // Memoized analytics and audit data
  const healthReport = useMemo(() => auditLexiconHealth(words), [words]);
  const letterFrequencies = useMemo(() => getLetterFrequencies(words).slice(0, 6), [words]);
  const bigrams = useMemo(() => getNgramFrequencies(words, 2).slice(0, 5), [words]);
  const trigrams = useMemo(() => getNgramFrequencies(words, 3).slice(0, 5), [words]);
  const entropy = useMemo(() => calculateEntropy(words), [words]);

  // Determine health color classes
  const healthTheme = useMemo(() => {
    const score = healthReport.score;
    if (score >= 80) {
      return {
        text: "text-green",
        border: "border-green/20",
        bg: "bg-green/10",
        bar: "bg-green",
        icon: ShieldCheck,
      };
    } else if (score >= 50) {
      return {
        text: "text-yellow",
        border: "border-yellow/20",
        bg: "bg-yellow/10",
        bar: "bg-yellow",
        icon: AlertTriangle,
      };
    } else {
      return {
        text: "text-red",
        border: "border-red/20",
        bg: "bg-red/10",
        bar: "bg-red",
        icon: ShieldAlert,
      };
    }
  }, [healthReport.score]);

  // Determine diversity details
  const diversityInfo = useMemo(() => {
    if (entropy === 0) {
      return {
        label: "Uniform / Single Sound",
        desc: "Requires more diverse characters to seed a Markov trie.",
        color: "text-red bg-red/5 border-red/20",
        pct: 0,
      };
    }
    // Max theoretical English entropy is around 4.38; standard range is 2.5 - 4.2
    const maxTheoretical = 4.5;
    const pct = Math.min(100, Math.round((entropy / maxTheoretical) * 100));

    if (entropy < 2.5) {
      return {
        label: "Low phonology diversity",
        desc: "Repetitive sounds; names will resemble each other highly.",
        color: "text-yellow bg-yellow/5 border-yellow/20",
        pct,
      };
    } else if (entropy < 3.5) {
      return {
        label: "Balanced phonology",
        desc: "Consistent cultural face with decent variation.",
        color: "text-tint bg-tint/5 border-tint/20",
        pct,
      };
    } else {
      return {
        label: "High phonology diversity",
        desc: "Varied sounds; names will have high phonetic difference.",
        color: "text-green bg-green/5 border-green/20",
        pct,
      };
    }
  }, [entropy]);

  const HealthIcon = healthTheme.icon;

  return (
    <Card
      variant="inset"
      padding="none"
      className="flex h-full flex-col justify-between space-y-5 p-4"
    >
      <div className="border-separator flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-tint text-body flex items-center gap-2 font-semibold">
            <Activity className="h-4 w-4" />
            <span>Lexicon explorer & health</span>
          </h3>
          <p className="text-label-secondary text-caption mt-0.5">
            Phonetic and structure analysis of the seed list.
          </p>
        </div>
      </div>

      {/* Main Grid: Health Indicator vs Phonetic Diversity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`rounded-row border p-4 ${healthTheme.border} ${healthTheme.bg} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-label-secondary text-eyebrow">Lexicon health</span>
            <HealthIcon className={`h-4.5 w-4.5 ${healthTheme.text}`} />
          </div>

          <div className="flex items-baseline gap-2">
            <span className={`text-large-title font-bold ${healthTheme.text}`}>
              {healthReport.score}
            </span>
            <span className="text-label-secondary text-footnote">/ 100</span>
          </div>

          <div className="bg-fill-2 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${healthTheme.bar} transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300`}
              style={{ width: `${healthReport.score}%` }}
            />
          </div>

          <div className="space-y-2 pt-1">
            {healthReport.issues.length === 0 ? (
              <div className="text-caption text-green flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>All health parameters check out perfectly!</span>
              </div>
            ) : (
              <div className="max-h-[110px] space-y-2 overflow-y-auto pr-1">
                {healthReport.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="text-label-secondary text-caption flex items-start gap-2 leading-tight"
                  >
                    <span className="text-yellow mt-0.5 shrink-0 font-semibold">•</span>
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Phonetic Diversity / Shannon Entropy Panel */}
        <div
          className={`rounded-row border p-4 ${diversityInfo.color} flex flex-col justify-between space-y-3`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-label-secondary text-eyebrow">Phonetic diversity</span>
              <Award className="text-label-secondary h-4.5 w-4.5" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-large-title font-bold">{entropy.toFixed(2)}</span>
              <span className="text-label-secondary text-footnote">bits / letter</span>
            </div>

            <span className="text-footnote block font-semibold">{diversityInfo.label}</span>
            <p className="text-label-secondary text-caption leading-snug">{diversityInfo.desc}</p>
          </div>

          <div className="mt-auto space-y-1 pt-1">
            <div className="text-label-secondary text-caption flex justify-between font-semibold">
              <span>Entropy range</span>
              <span>{diversityInfo.pct}%</span>
            </div>
            <div className="bg-fill-2 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={`bg-tint h-full rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300`}
                style={{ width: `${diversityInfo.pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section: Letters vs Bigrams/Trigrams */}
      <div className="grid gap-4 pt-2 sm:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-label-secondary border-separator text-subhead flex items-center gap-2 border-b pb-2">
            <BarChart3 className="text-tint h-3.5 w-3.5" />
            <span>Top letter densities</span>
          </h4>

          {letterFrequencies.length === 0 ? (
            <div className="text-label-secondary text-caption py-6 text-center">
              No letter data available.
            </div>
          ) : (
            <div className="space-y-2">
              {letterFrequencies.map(({ letter, frequency }) => (
                <div key={letter} className="space-y-0.5">
                  <div className="text-caption flex justify-between font-semibold">
                    <span className="text-label font-mono uppercase">{letter}</span>
                    <span className="text-label-secondary">{(frequency * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bg-fill-3 h-1 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-tint/60 h-full rounded-full"
                      style={{ width: `${frequency * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* N-Gram Frequencies (Bigrams/Trigrams Side-by-side or combined list) */}
        <div className="space-y-2">
          <h4 className="text-label-secondary border-separator text-subhead flex items-center gap-2 border-b pb-2">
            <Layers className="text-tint h-3.5 w-3.5" />
            <span>Frequent substrings</span>
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-label-secondary border-separator text-eyebrow block border-b pb-0.5">
                Bigrams (2-char)
              </span>
              {bigrams.length === 0 ? (
                <div className="text-label-secondary text-caption py-2 text-center">None</div>
              ) : (
                <div className="space-y-1">
                  {bigrams.map(({ ngram, count }) => (
                    <div key={ngram} className="text-caption flex items-center justify-between">
                      <span className="text-label bg-fill-3 rounded-control-sm px-1 py-0.5 font-mono font-semibold uppercase">
                        {ngram}
                      </span>
                      <span className="text-label-secondary text-caption font-semibold">
                        {count} {count === 1 ? "time" : "times"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-label-secondary border-separator text-eyebrow block border-b pb-0.5">
                Trigrams (3-char)
              </span>
              {trigrams.length === 0 ? (
                <div className="text-label-secondary text-caption py-2 text-center">None</div>
              ) : (
                <div className="space-y-1">
                  {trigrams.map(({ ngram, count }) => (
                    <div key={ngram} className="text-caption flex items-center justify-between">
                      <span className="text-label bg-fill-3 rounded-control-sm px-1 py-0.5 font-mono font-semibold uppercase">
                        {ngram}
                      </span>
                      <span className="text-label-secondary text-caption font-semibold">
                        {count} {count === 1 ? "time" : "times"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
