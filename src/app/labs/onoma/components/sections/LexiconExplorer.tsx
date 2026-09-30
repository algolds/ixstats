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
import { FacetCard } from "~/components/ui/facet-container";
import {
  getLetterFrequencies,
  getNgramFrequencies,
  calculateEntropy,
  auditLexiconHealth,
} from "~/lib/onoma/lexicon-analytics";

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
        text: "text-emerald-500 dark:text-emerald-400",
        border: "border-emerald-500/20 dark:border-emerald-500/30",
        bg: "bg-emerald-500/10 dark:bg-emerald-500/5",
        bar: "bg-emerald-500",
        icon: ShieldCheck,
      };
    } else if (score >= 50) {
      return {
        text: "text-amber-500 dark:text-amber-400",
        border: "border-amber-500/20 dark:border-amber-500/30",
        bg: "bg-amber-500/10 dark:bg-amber-500/5",
        bar: "bg-amber-500",
        icon: AlertTriangle,
      };
    } else {
      return {
        text: "text-red-500 dark:text-red-400",
        border: "border-red-500/20 dark:border-red-500/30",
        bg: "bg-red-500/10 dark:bg-red-500/5",
        bar: "bg-red-500",
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
        color: "text-red-500 bg-red-500/5 border-red-500/20",
        pct: 0,
      };
    }
    // Max theoretical English entropy is around 4.38; standard range is 2.5 - 4.2
    const maxTheoretical = 4.5;
    const pct = Math.min(100, Math.round((entropy / maxTheoretical) * 100));

    if (entropy < 2.5) {
      return {
        label: "Low Phonology Diversity",
        desc: "Repetitive sounds; names will resemble each other highly.",
        color: "text-amber-500 bg-amber-500/5 border-amber-500/20",
        pct,
      };
    } else if (entropy < 3.5) {
      return {
        label: "Balanced Phonology",
        desc: "Consistent cultural face with decent variation.",
        color: "text-onoma-primary bg-onoma-primary/5 border-onoma-primary/20",
        pct,
      };
    } else {
      return {
        label: "High Phonology Diversity",
        desc: "Varied sounds; names will have high phonetic difference.",
        color: "text-emerald-500 bg-emerald-500/5 border-emerald-500/20",
        pct,
      };
    }
  }, [entropy]);

  const HealthIcon = healthTheme.icon;

  return (
    <FacetCard className="border-border/40 bg-secondary/5 flex h-full flex-col justify-between space-y-5 border p-4">
      {/* Header */}
      <div className="border-border/40 flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-onoma-primary flex items-center gap-1.5 text-sm font-bold tracking-tight">
            <Activity className="h-4 w-4" />
            <span>Lexicon Explorer & Health</span>
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            Real-time phonetic and structure analysis of the seed list.
          </p>
        </div>
      </div>

      {/* Main Grid: Health Indicator vs Phonetic Diversity */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Health Score Panel */}
        <div
          className={`rounded-xl border p-3.5 ${healthTheme.border} ${healthTheme.bg} space-y-3`}
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Lexicon Health
            </span>
            <HealthIcon className={`h-4.5 w-4.5 ${healthTheme.text}`} />
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-extrabold tracking-tight ${healthTheme.text}`}>
              {healthReport.score}
            </span>
            <span className="text-muted-foreground text-xs">/ 100</span>
          </div>

          {/* Mini Health Bar */}
          <div className="bg-secondary/60 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${healthTheme.bar} transition-all duration-300`}
              style={{ width: `${healthReport.score}%` }}
            />
          </div>

          {/* Issues list */}
          <div className="space-y-1.5 pt-1">
            {healthReport.issues.length === 0 ? (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>All health parameters check out perfectly!</span>
              </div>
            ) : (
              <div className="max-h-[110px] space-y-1.5 overflow-y-auto pr-1">
                {healthReport.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="text-foreground/80 dark:text-foreground/90 flex items-start gap-1.5 text-[10px] leading-tight"
                  >
                    <span className="mt-0.5 shrink-0 font-bold text-amber-500">•</span>
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Phonetic Diversity / Shannon Entropy Panel */}
        <div
          className={`rounded-xl border p-3.5 ${diversityInfo.color} flex flex-col justify-between space-y-3`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Phonetic Diversity
              </span>
              <Award className="text-muted-foreground/75 h-4.5 w-4.5" />
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight">{entropy.toFixed(2)}</span>
              <span className="text-muted-foreground text-xs">bits / letter</span>
            </div>

            <span className="block text-xs font-bold">{diversityInfo.label}</span>
            <p className="text-muted-foreground text-[10px] leading-snug">{diversityInfo.desc}</p>
          </div>

          {/* Diversity progress bar */}
          <div className="mt-auto space-y-1 pt-1">
            <div className="text-muted-foreground flex justify-between text-[9px] font-semibold">
              <span>Entropy Range</span>
              <span>{diversityInfo.pct}%</span>
            </div>
            <div className="bg-secondary/60 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={`bg-onoma-primary h-full rounded-full transition-all duration-300`}
                style={{ width: `${diversityInfo.pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section: Letters vs Bigrams/Trigrams */}
      <div className="grid gap-4 pt-2 sm:grid-cols-2">
        {/* Letter Frequencies */}
        <div className="space-y-2.5">
          <h4 className="text-muted-foreground border-border/40 flex items-center gap-1.5 border-b pb-1.5 text-xs font-bold tracking-wider uppercase">
            <BarChart3 className="text-onoma-primary h-3.5 w-3.5" />
            <span>Top Letter Densities</span>
          </h4>

          {letterFrequencies.length === 0 ? (
            <div className="text-muted-foreground py-6 text-center text-[10px]">
              No letter data available.
            </div>
          ) : (
            <div className="space-y-2">
              {letterFrequencies.map(({ letter, frequency }) => (
                <div key={letter} className="space-y-0.5">
                  <div className="flex justify-between text-[10px] font-semibold">
                    <span className="text-foreground font-mono uppercase">{letter}</span>
                    <span className="text-muted-foreground">{(frequency * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bg-secondary/50 h-1 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-onoma-primary/60 h-full rounded-full"
                      style={{ width: `${frequency * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* N-Gram Frequencies (Bigrams/Trigrams Side-by-side or combined list) */}
        <div className="space-y-2.5">
          <h4 className="text-muted-foreground border-border/40 flex items-center gap-1.5 border-b pb-1.5 text-xs font-bold tracking-wider uppercase">
            <Layers className="text-onoma-primary h-3.5 w-3.5" />
            <span>Frequent Substrings</span>
          </h4>

          <div className="grid grid-cols-2 gap-3.5">
            {/* Bigrams */}
            <div className="space-y-2">
              <span className="text-muted-foreground border-border/20 block border-b pb-0.5 text-[10px] font-bold uppercase">
                Bigrams (2-char)
              </span>
              {bigrams.length === 0 ? (
                <div className="text-muted-foreground py-2 text-center text-[9px]">None</div>
              ) : (
                <div className="space-y-1">
                  {bigrams.map(({ ngram, count }) => (
                    <div key={ngram} className="flex items-center justify-between text-[10px]">
                      <span className="text-foreground bg-secondary/50 rounded px-1 py-0.5 font-mono font-bold uppercase">
                        {ngram}
                      </span>
                      <span className="text-muted-foreground text-[9px] font-semibold">
                        {count} {count === 1 ? "time" : "times"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trigrams */}
            <div className="space-y-2">
              <span className="text-muted-foreground border-border/20 block border-b pb-0.5 text-[10px] font-bold uppercase">
                Trigrams (3-char)
              </span>
              {trigrams.length === 0 ? (
                <div className="text-muted-foreground py-2 text-center text-[9px]">None</div>
              ) : (
                <div className="space-y-1">
                  {trigrams.map(({ ngram, count }) => (
                    <div key={ngram} className="flex items-center justify-between text-[10px]">
                      <span className="text-foreground bg-secondary/50 rounded px-1 py-0.5 font-mono font-bold uppercase">
                        {ngram}
                      </span>
                      <span className="text-muted-foreground text-[9px] font-semibold">
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
    </FacetCard>
  );
}
