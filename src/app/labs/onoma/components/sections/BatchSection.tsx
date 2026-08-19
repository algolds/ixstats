"use client";

// src/app/labs/onoma/components/sections/BatchSection.tsx
// Onoma Lab — Batch Name Synthesis & Workbench

import React, { useState, useMemo } from "react";
import {
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { EconomyGameIcon } from "../nav/onoma-tabs";
import { FacetMaterial } from "~/components/ui/facet";
import { api } from "~/trpc/react";
import { useNameBank } from "~/hooks/useNameBank";
import { useNotify } from "~/hooks/useNotify";
import { speakName } from "~/lib/onoma/browser-speech";
import { exportToCSV, exportToJSON } from "~/lib/onoma/name-generator";
import type { NameCategory } from "~/lib/onoma/types";
import {
  BATCH_CATEGORIES,
  BATCH_PROFILES,
  getBatchSubTypes,
  type BatchNameResult,
} from "./batch/batch-constants";
import { BatchResultsTable } from "./batch/BatchResultsTable";

export default function BatchSection() {
  const notify = useNotify();
  const bank = useNameBank();

  // Primary parameters
  const [count, setCount] = useState<number>(100);
  const [category, setCategory] = useState<string>("city");
  const [profile, setProfile] = useState<string>("any");
  const [trainingMode, setTrainingMode] = useState<"preset" | "lexicon" | "ixworld">("preset");
  const [subType, setSubType] = useState<string>("generic");
  const [gender, setGender] = useState<"male" | "female" | "neutral">("neutral");
  const [order, setOrder] = useState<number>(2);

  // Prefix & Suffix
  const [selectedPrefix, setSelectedPrefix] = useState<string>("");
  const [customPrefix, setCustomPrefix] = useState<string>("");
  const [selectedSuffix, setSelectedSuffix] = useState<string>("");
  const [customSuffix, setCustomSuffix] = useState<string>("");

  // Advanced constraints
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [minLength, setMinLength] = useState<number>(4);
  const [maxLength, setMaxLength] = useState<number>(12);
  const [startsWith, setStartsWith] = useState<string>("");
  const [endsWith, setEndsWith] = useState<string>("");
  const [contains, setContains] = useState<string>("");
  const [excludes, setExcludes] = useState<string>("");
  const [minSyllables, setMinSyllables] = useState<number>(1);
  const [maxSyllables, setMaxSyllables] = useState<number>(6);
  const [allowDoubleLetters, setAllowDoubleLetters] = useState<boolean>(true);
  const [maxConsonantCluster, setMaxConsonantCluster] = useState<number>(3);
  const [maxVowelCluster, setMaxVowelCluster] = useState<number>(3);

  // Results & UI state
  const [results, setResults] = useState<BatchNameResult[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<{
    column: keyof BatchNameResult;
    direction: "asc" | "desc";
  }>({
    column: "perplexity",
    direction: "desc",
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [perplexityFilter, setPerplexityFilter] = useState<number>(0);

  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  const batchMutation = api.onoma.batchGenerate.useMutation({
    onSuccess: (data) => {
      setResults(data.names);
      setSelectedNames(new Set());
      notify.success(`Successfully generated ${data.names.length} names.`);
    },
    onError: (err) => {
      notify.error(`Generation failed: ${err.message}`);
    },
  });

  const subTypes = useMemo(() => getBatchSubTypes(category), [category]);

  const handleGenerate = () => {
    batchMutation.mutate({
      count,
      category,
      culturalProfile: profile,
      trainingMode,
      subType,
      gender,
      selectedPrefix,
      customPrefix,
      selectedSuffix,
      customSuffix,
      order,
      options: {
        minLength,
        maxLength,
        startsWith: startsWith || undefined,
        endsWith: endsWith || undefined,
        contains: contains || undefined,
        excludes: excludes || undefined,
        allowDuplicates: false,
        maxConsonantCluster,
        maxVowelCluster,
        allowDoubleLetters,
        minSyllables,
        maxSyllables,
        mustEndWithVowel: false,
        mustEndWithConsonant: false,
      },
    });
  };

  const handleSort = (column: keyof BatchNameResult) => {
    setSorting((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const handleSelectName = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedNames.size === filteredResults.length) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(filteredResults.map((r) => r.name)));
    }
  };

  const handleBulkSave = async () => {
    if (selectedNames.size === 0) return;
    const namesArray = Array.from(selectedNames);
    let savedCount = 0;

    for (const name of namesArray) {
      try {
        await bank.saveEntry({
          type: "saved-name",
          title: name,
          values: [name],
          category: category as NameCategory,
          culturalProfile: profile !== "any" ? (profile as any) : null,
        });
        savedCount++;
      } catch (err) {
        console.error(`Failed to save ${name}:`, err);
      }
    }

    notify.success(`Saved ${savedCount} names to your Stash.`);
    setSelectedNames(new Set());
  };

  const playName = (name: string, ipa: string) => {
    speakName({
      name,
      ipa,
      culture: profile,
      kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
      voice: undefined,
      defaultVoice: speechConfig?.kokoro?.voice,
      forceDefaultVoice: false,
    });
  };

  const handleExportCSV = () => {
    exportToCSV(filteredResults, `onoma-batch-${category}-${profile}.csv`);
  };

  const handleExportJSON = () => {
    const meta = { count, category, profile, trainingMode, options: { minLength, maxLength } };
    exportToJSON(filteredResults, meta, `onoma-batch-${category}-${profile}.json`);
  };

  // Filter & Sort pipeline
  const filteredResults = useMemo(() => {
    let list = [...results];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.ipa.toLowerCase().includes(q));
    }
    if (perplexityFilter > 0) {
      list = list.filter((r) => r.perplexity <= perplexityFilter);
    }
    list.sort((a, b) => {
      const valA = a[sorting.column];
      const valB = b[sorting.column];
      if (typeof valA === "string" && typeof valB === "string") {
        return sorting.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sorting.direction === "asc" ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
    return list;
  }, [results, searchQuery, perplexityFilter, sorting]);

  return (
    <div className="space-y-6">
      {/* Workbench Header */}
      <div className="border-b border-border/40 pb-3 text-left">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <EconomyGameIcon className="h-4 w-4 text-[#10b981]" /> Batch Generation Workbench
        </h3>
        <p className="text-sm text-muted-foreground">
          Synthesize large corpora of procedurally generated names, filter by phonetic naturalness,
          and bulk-export to CSV or JSON.
        </p>
      </div>

      {/* Primary Configuration Grid */}
      <FacetMaterial material="satin" className="rounded-xl border border-border/40 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-left">
          {/* Category */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
            >
              {BATCH_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Cultural Profile */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Phonetic Profile</label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
            >
              {BATCH_PROFILES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* SubType (if available) */}
          {subTypes.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Subtype Taxonomy</label>
              <select
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
                className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
              >
                {subTypes.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Batch Size */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Batch Size</label>
              <span className="font-mono text-xs font-semibold text-[#10b981]">{count} names</span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full cursor-pointer accent-[#10b981]"
            />
          </div>
        </div>

        {/* Collapsible Advanced Constraints */}
        <div className="border-t border-border/20 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-xs font-bold text-foreground hover:text-[#10b981] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-[#10b981]" /> Phonotactic & Length Constraints
            </span>
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-left text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Min Length: {minLength}</label>
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={minLength}
                  onChange={(e) => setMinLength(Number(e.target.value))}
                  className="w-full accent-[#10b981]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Max Length: {maxLength}</label>
                <input
                  type="range"
                  min={6}
                  max={24}
                  value={maxLength}
                  onChange={(e) => setMaxLength(Number(e.target.value))}
                  className="w-full accent-[#10b981]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Starts With</label>
                <input
                  type="text"
                  placeholder="e.g. Al"
                  value={startsWith}
                  onChange={(e) => setStartsWith(e.target.value)}
                  className="w-full rounded border border-border/60 bg-background px-2 py-1 text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">Ends With</label>
                <input
                  type="text"
                  placeholder="e.g. ia"
                  value={endsWith}
                  onChange={(e) => setEndsWith(e.target.value)}
                  className="w-full rounded border border-border/60 bg-background px-2 py-1 text-xs focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Generate Trigger */}
        <button
          onClick={handleGenerate}
          disabled={batchMutation.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#10b981] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#059669] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
        >
          {batchMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <EconomyGameIcon className="h-4 w-4" />
          )}
          <span>{batchMutation.isPending ? "Assembling Corpus..." : `Synthesize ${count} Names`}</span>
        </button>
      </FacetMaterial>

      {/* Results View */}
      {results.length > 0 && (
        <BatchResultsTable
          results={filteredResults}
          category={category}
          profile={profile}
          selectedNames={selectedNames}
          sorting={sorting}
          searchQuery={searchQuery}
          perplexityFilter={perplexityFilter}
          onSearchChange={setSearchQuery}
          onPerplexityChange={setPerplexityFilter}
          onSort={handleSort}
          onSelectName={handleSelectName}
          onSelectAll={handleSelectAll}
          onBulkSave={handleBulkSave}
          onPlayName={playName}
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
        />
      )}
    </div>
  );
}
