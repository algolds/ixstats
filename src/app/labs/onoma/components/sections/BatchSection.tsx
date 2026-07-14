"use client";

// src/app/labs/onoma/components/sections/BatchSection.tsx
// Onoma Lab — Batch Name Generator & Workbench

import { useState, useMemo } from "react";
import {
  Wand2,
  FileDown,
  Volume2,
  Bookmark,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FacetMaterial } from "~/components/facet-ui";
import { api } from "~/trpc/react";
import { useNameBank } from "~/hooks/useNameBank";
import { useNotify } from "~/hooks/useNotify";
import { speakName } from "~/lib/onoma/browser-speech";
import { exportToCSV, exportToJSON } from "~/lib/onoma/export";
import type { NameCategory } from "~/lib/onoma/types";

interface BatchNameResult {
  name: string;
  ipa: string;
  syllables: number;
  perplexity: number;
  length: number;
}

const CATEGORIES = [
  { value: "country", label: "Nations & Realms" },
  { value: "city", label: "Cities & Towns" },
  { value: "province", label: "Provinces & States" },
  { value: "geography", label: "Landmarks & Features" },
  { value: "person", label: "Characters & Rulers" },
  { value: "dynasty", label: "Dynasties & Families" },
  { value: "military", label: "Military & Formations" },
  { value: "organization", label: "Guilds & Orders" },
  { value: "culture", label: "Ethnic Groups & Tribes" },
  { value: "ship", label: "Vessel & Ship Names" },
];

const PROFILES = [
  { value: "any", label: "Any / Combined Profile" },
  { value: "latin", label: "Latin / Roman" },
  { value: "germanic", label: "Germanic / Norse" },
  { value: "celtic", label: "Celtic / Gaelic" },
  { value: "slavic", label: "Slavic / Eastern European" },
  { value: "arabic", label: "Arabic / Near Eastern" },
  { value: "east-asian", label: "East Asian" },
  { value: "austronesian", label: "Austronesian" },
  { value: "persian", label: "Persian" },
  { value: "turkic", label: "Turkic" },
  { value: "african", label: "African" },
  { value: "indic", label: "Indic" },
  { value: "uralic", label: "Uralic" },
  { value: "constructed", label: "Constructed Conlang" },
];

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
  const [sorting, setSorting] = useState<{ column: keyof BatchNameResult; direction: "asc" | "desc" }>({
    column: "perplexity",
    direction: "desc",
  });
  const [copiedName, setCopiedName] = useState<string | null>(null);

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

  const getSubTypes = () => {
    if (category === "city") {
      return [
        { value: "generic", label: "City Name (Default)" },
        { value: "settlement-colony", label: "Settlement / Colony" },
      ];
    }
    if (category === "geography") {
      return [
        { value: "generic", label: "Landmark Name (Default)" },
        { value: "natural-landmark", label: "Natural Landmark" },
        { value: "architecture", label: "Architecture & Buildings" },
      ];
    }
    if (category === "person") {
      return [
        { value: "generic", label: "Person Name (Default)" },
        { value: "goblin", label: "Goblin" },
        { value: "orc", label: "Orc" },
        { value: "ogre", label: "Ogre" },
        { value: "primitive", label: "Primitive Tribal" },
        { value: "dwarf", label: "Dwarf" },
        { value: "halfling", label: "Halfling" },
        { value: "gnome", label: "Gnome" },
        { value: "elf", label: "Elf" },
        { value: "elf-alt", label: "Elf Alternate" },
        { value: "faery", label: "Faery" },
        { value: "faery-alt", label: "Faery Alternate" },
        { value: "dark-elf", label: "Dark Elf" },
        { value: "dark-elf-alt", label: "Dark Elf Alternate" },
        { value: "half-demon", label: "Half-Demon" },
        { value: "dragon", label: "Dragon" },
        { value: "demon", label: "Demon" },
        { value: "angel", label: "Angel" },
      ];
    }
    if (category === "organization") {
      return [
        { value: "generic", label: "Organization (Default)" },
        { value: "mystic-order", label: "Mystic Order" },
        { value: "military-unit", label: "Military Formation" },
        { value: "covert-org", label: "Covert Organization" },
        { value: "tavern", label: "Tavern & Inn" },
        { value: "business-company", label: "Guild / Company" },
        { value: "academic-institution", label: "Academy" },
        { value: "political-party", label: "Faction / Caucus" },
        { value: "government-agency", label: "Directorate / Ministry" },
        { value: "media-outlet", label: "Gazette / Broadcaster" },
        { value: "ngo-foundation", label: "Charitable Foundation" },
        { value: "religious-order", label: "Priesthood" },
      ];
    }
    if (category === "military") {
      return [
        { value: "generic", label: "Military (Default)" },
        { value: "military-unit", label: "Army Regiment" },
        { value: "mercenary-band", label: "Mercenary Company" },
      ];
    }
    if (category === "dynasty") {
      return [
        { value: "generic", label: "Dynasty (Default)" },
        { value: "fantasy-syllable", label: "Fantasy Syllable Name" },
        { value: "noble-surname", label: "Noble Surname" },
      ];
    }
    return [];
  };

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

    notify.success(`Saved ${savedCount} names to your Name Bank.`);
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
    const meta = { count, category, profile, trainingMode };
    exportToCSV(filteredResults, `onoma-batch-${category}-${profile}.csv`);
  };

  const handleExportJSON = () => {
    const meta = { count, category, profile, trainingMode, options: { minLength, maxLength } };
    exportToJSON(filteredResults, meta, `onoma-batch-${category}-${profile}.json`);
  };

  // Filter & Sort results pipeline
  const filteredResults = useMemo(() => {
    let list = [...results];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (perplexityFilter > 0) {
      list = list.filter((r) => r.perplexity >= perplexityFilter);
    }

    list.sort((a, b) => {
      const aVal = a[sorting.column];
      const bVal = b[sorting.column];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sorting.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sorting.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return list;
  }, [results, searchQuery, perplexityFilter, sorting]);

  const avgPerplexity = useMemo(() => {
    if (results.length === 0) return 0;
    return Math.round(results.reduce((acc, r) => acc + r.perplexity, 0) / results.length);
  }, [results]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Parameters Panel */}
      <div className="space-y-4 lg:col-span-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Batch Setup
          </h3>
        </div>

        <div className="space-y-3">
          {/* Category */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Name Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubType("generic");
              }}
              className="w-full px-3 py-2 border rounded-lg bg-background/50 border-border/40 text-foreground text-sm"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subtype (Conditional) */}
          {getSubTypes().length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Template / Sub-type</label>
              <select
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background/50 border-border/40 text-foreground text-sm"
              >
                {getSubTypes().map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cultural Profile */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Linguistic Family</label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background/50 border-border/40 text-foreground text-sm"
            >
              {PROFILES.map((prof) => (
                <option key={prof.value} value={prof.value}>
                  {prof.label}
                </option>
              ))}
            </select>
          </div>

          {/* Training Mode */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Markov Training Mode</label>
            <div className="grid grid-cols-3 gap-1 p-1 border rounded-lg bg-background/30 border-border/40">
              {(["preset", "lexicon", "ixworld"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTrainingMode(mode)}
                  className={`py-1 text-[11px] font-bold rounded capitalize cursor-pointer transition-all ${
                    trainingMode === mode
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/20"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Count Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground">
              <span>Names Count</span>
              <span className="font-mono text-amber-500 font-bold">{count}</span>
            </div>
            <input
              type="range"
              min={10}
              max={1000}
              step={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Expandable Advanced Options */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <Sliders className="h-3 w-3" />
            <span>{showAdvanced ? "Hide" : "Show"} Advanced Options</span>
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showAdvanced && (
            <div className="p-3 border rounded-lg bg-secondary/10 border-border/30 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Min Length</label>
                  <input
                    type="number"
                    value={minLength}
                    onChange={(e) => setMinLength(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs border rounded bg-background/50 border-border/40 text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Max Length</label>
                  <input
                    type="number"
                    value={maxLength}
                    onChange={(e) => setMaxLength(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs border rounded bg-background/50 border-border/40 text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Starts With</label>
                  <input
                    type="text"
                    value={startsWith}
                    onChange={(e) => setStartsWith(e.target.value)}
                    placeholder="e.g. Ka"
                    className="w-full px-2 py-1 text-xs border rounded bg-background/50 border-border/40 text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Ends With</label>
                  <input
                    type="text"
                    value={endsWith}
                    onChange={(e) => setEndsWith(e.target.value)}
                    placeholder="e.g. an"
                    className="w-full px-2 py-1 text-xs border rounded bg-background/50 border-border/40 text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allowDoubleLetters}
                    onChange={(e) => setAllowDoubleLetters(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  Allow Double Letters (aa, ll, ss)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Max Consonant Cluster</label>
                  <input
                    type="number"
                    value={maxConsonantCluster}
                    onChange={(e) => setMaxConsonantCluster(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs border rounded bg-background/50 border-border/40 text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Max Vowel Cluster</label>
                  <input
                    type="number"
                    value={maxVowelCluster}
                    onChange={(e) => setMaxVowelCluster(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs border rounded bg-background/50 border-border/40 text-foreground"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Trigger */}
          <button
            onClick={handleGenerate}
            disabled={batchMutation.isPending}
            className="w-full flex cursor-pointer items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            {batchMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {batchMutation.isPending ? "Assembling Batch..." : "Assemble Batch"}
          </button>
        </div>
      </div>

      {/* Generation Results Panel */}
      <div className="space-y-4 lg:col-span-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/40">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Workbench & Output
          </h3>

          {/* Bulk Exports / Actions */}
          {results.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleBulkSave}
                disabled={selectedNames.size === 0}
                className="flex items-center gap-1 border border-border/40 bg-secondary/20 hover:bg-secondary/40 text-foreground rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all disabled:opacity-30 active:scale-95"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>Save Selected ({selectedNames.size})</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1 border border-border/40 bg-secondary/20 hover:bg-secondary/40 text-foreground rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all active:scale-95"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1 border border-border/40 bg-secondary/20 hover:bg-secondary/40 text-foreground rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all active:scale-95"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>JSON</span>
              </button>
            </div>
          )}
        </div>

        {results.length === 0 ? (
          <FacetMaterial material="satin" className="border border-border/20 p-12 text-center">
            <Wand2 className="mx-auto h-12 w-12 text-muted-foreground opacity-30 mb-4 animate-pulse" />
            <p className="text-sm text-muted-foreground">
              Select your parameters on the left and click "Assemble Batch" to fill this workbench.
            </p>
          </FacetMaterial>
        ) : (
          <div className="space-y-4">
            {/* Summary statistics bar */}
            <div className="grid grid-cols-3 gap-2 p-3 border border-border/20 rounded-lg bg-secondary/5 text-center text-xs">
              <div>
                <span className="text-muted-foreground block">Total Count</span>
                <span className="font-bold text-foreground">{results.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Unique Yield</span>
                <span className="font-bold text-amber-500">{filteredResults.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Avg Naturalness</span>
                <span className="font-bold text-foreground">{avgPerplexity}%</span>
              </div>
            </div>

            {/* Filter Search inputs */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search generated name..."
                className="flex-1 px-3 py-1.5 border rounded-lg bg-background/50 border-border/40 text-foreground text-xs focus:outline-none focus:border-amber-500/50"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                  Min Naturalness:
                </span>
                <select
                  value={perplexityFilter}
                  onChange={(e) => setPerplexityFilter(Number(e.target.value))}
                  className="px-2 py-1.5 border rounded-lg bg-background/50 border-border/40 text-foreground text-xs"
                >
                  <option value={0}>Any Score</option>
                  <option value={30}>&gt;= 30%</option>
                  <option value={50}>&gt;= 50% (Natural)</option>
                  <option value={70}>&gt;= 70% (Flowing)</option>
                  <option value={90}>&gt;= 90% (Perfect)</option>
                </select>
              </div>
            </div>

            {/* Output table */}
            <div className="border border-border/20 rounded-lg overflow-hidden bg-background/30 shadow-inner">
              <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground font-semibold sticky top-0 border-b border-border/20 select-none">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedNames.size === filteredResults.length && filteredResults.length > 0}
                          onChange={handleSelectAll}
                          className="accent-amber-500 cursor-pointer rounded"
                        />
                      </th>
                      <th
                        className="p-3 cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort("name")}
                      >
                        Name {sorting.column === "name" && (sorting.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th
                        className="p-3 cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort("ipa")}
                      >
                        IPA Pronunciation {sorting.column === "ipa" && (sorting.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th
                        className="p-3 text-center cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort("syllables")}
                      >
                        Syllables {sorting.column === "syllables" && (sorting.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th
                        className="p-3 text-center cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort("perplexity")}
                      >
                        Naturalness {sorting.column === "perplexity" && (sorting.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="p-3 w-16 text-center">Play</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {filteredResults.map((item) => {
                      const isChecked = selectedNames.has(item.name);
                      return (
                        <tr
                          key={item.name}
                          className="hover:bg-secondary/10 transition-colors cursor-pointer"
                          onClick={() => handleSelectName(item.name)}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSelectName(item.name)}
                              className="accent-amber-500 cursor-pointer rounded"
                            />
                          </td>
                          <td className="p-3 font-semibold text-foreground">{item.name}</td>
                          <td className="p-3 text-muted-foreground font-mono">{item.ipa}</td>
                          <td className="p-3 text-center text-muted-foreground">{item.syllables}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.perplexity >= 70
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : item.perplexity >= 45
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {item.perplexity}%
                            </span>
                          </td>
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => playName(item.name, item.ipa)}
                              className="p-1 hover:bg-secondary/40 text-muted-foreground hover:text-amber-500 rounded cursor-pointer transition-colors active:scale-90"
                              title="Pronounce Name"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
