"use client";

// src/app/labs/onoma/components/sections/batch/BatchResultsTable.tsx
// Results data table with sorting, search filtering, audio synthesis, and bulk stash actions

import React, { useState } from "react";
import { Volume2, Bookmark, FileDown, Copy, Check, HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import type { BatchNameResult } from "./batch-constants";

interface BatchResultsTableProps {
  results: BatchNameResult[];
  category: string;
  profile: string;
  selectedNames: Set<string>;
  sorting: {
    column: keyof BatchNameResult;
    direction: "asc" | "desc";
  };
  searchQuery: string;
  perplexityFilter: number;
  onSearchChange: (q: string) => void;
  onPerplexityChange: (p: number) => void;
  onSort: (col: keyof BatchNameResult) => void;
  onSelectName: (name: string) => void;
  onSelectAll: () => void;
  onBulkSave: () => void;
  onPlayName: (name: string, ipa: string) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export function BatchResultsTable({
  results,
  selectedNames,
  sorting,
  searchQuery,
  perplexityFilter,
  onSearchChange,
  onPerplexityChange,
  onSort,
  onSelectName,
  onSelectAll,
  onBulkSave,
  onPlayName,
  onExportCSV,
  onExportJSON,
}: BatchResultsTableProps) {
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const handleCopy = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search generated names..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="border-border/60 bg-background text-foreground rounded-md border px-2.5 py-1 text-xs focus:outline-none"
          />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span>Max Perplexity:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex cursor-help items-center transition-colors focus:outline-none"
                    aria-label="What is Perplexity?"
                  >
                    <HelpCircle className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs space-y-1.5 p-3 text-xs">
                  <p className="text-foreground font-semibold">Perplexity (Linguistic Surprise)</p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Measures how unexpected or unusual a word&apos;s letter transitions are relative
                    to the training phonology model.
                  </p>
                  <div className="border-border/40 grid grid-cols-2 gap-1.5 border-t pt-1 font-mono text-[10px]">
                    <span className="font-medium text-emerald-500">&lt; 25: Natural & familiar</span>
                    <span className="font-medium text-amber-500">25–50: Balanced</span>
                    <span className="col-span-2 font-medium text-rose-500">
                      &gt; 50: Exotic & unusual transitions
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={perplexityFilter}
              onChange={(e) => onPerplexityChange(Number(e.target.value))}
              className="w-20 accent-[#0091ff]"
            />
            <span className="font-mono text-[11px] font-semibold text-[#0091ff]">
              {perplexityFilter > 0 ? `< ${perplexityFilter}` : "All"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedNames.size > 0 && (
            <button
              onClick={onBulkSave}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400 cursor-pointer"
            >
              <Bookmark className="h-3.5 w-3.5" /> Save Selected ({selectedNames.size})
            </button>
          )}
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary/40 cursor-pointer"
          >
            <FileDown className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            onClick={onExportJSON}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary/40 cursor-pointer"
          >
            <FileDown className="h-3.5 w-3.5" /> JSON
          </button>
        </div>
      </div>

      {/* Results table */}
      <div className="max-h-[500px] overflow-y-auto rounded-lg border border-border/40">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/40">
            <tr>
              <th className="p-2 w-8 text-center">
                <input
                  type="checkbox"
                  checked={results.length > 0 && selectedNames.size === results.length}
                  onChange={onSelectAll}
                  className="rounded border-border/60 accent-[#0091ff] cursor-pointer"
                />
              </th>
              <th
                onClick={() => onSort("name")}
                className="p-2 font-bold text-foreground cursor-pointer hover:text-[#0091ff]"
              >
                Name {sorting.column === "name" && (sorting.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-2 font-bold text-foreground">IPA Transcription</th>
              <th
                onClick={() => onSort("syllables")}
                className="p-2 font-bold text-foreground cursor-pointer hover:text-[#0091ff]"
              >
                Syllables{" "}
                {sorting.column === "syllables" && (sorting.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-2 font-bold text-foreground">
                <div className="flex items-center gap-1">
                  <span
                    onClick={() => onSort("perplexity")}
                    className="cursor-pointer hover:text-[#0091ff]"
                  >
                    Perplexity{" "}
                    {sorting.column === "perplexity" && (sorting.direction === "asc" ? "↑" : "↓")}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground inline-flex cursor-help items-center transition-colors focus:outline-none"
                        aria-label="What is Perplexity?"
                      >
                        <HelpCircle className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs space-y-1.5 p-3 text-xs">
                      <p className="text-foreground font-semibold">Perplexity (Linguistic Surprise)</p>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        Measures how unexpected or unusual a word&apos;s letter transitions are relative
                        to the training phonology model.
                      </p>
                      <div className="border-border/40 grid grid-cols-2 gap-1.5 border-t pt-1 font-mono text-[10px]">
                        <span className="font-medium text-emerald-500">&lt; 25: Natural & familiar</span>
                        <span className="font-medium text-amber-500">25–50: Balanced</span>
                        <span className="col-span-2 font-medium text-rose-500">
                          &gt; 50: Exotic & unusual transitions
                        </span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {results.map((r, i) => {
              const isSelected = selectedNames.has(r.name);
              return (
                <tr
                  key={r.name + i}
                  className={`hover:bg-secondary/20 transition-colors ${
                    isSelected ? "bg-[#0091ff]/5" : ""
                  }`}
                >
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectName(r.name)}
                      className="rounded border-border/60 accent-[#0091ff] cursor-pointer"
                    />
                  </td>
                  <td className="p-2 font-semibold text-foreground">{r.name}</td>
                  <td className="p-2 font-mono text-muted-foreground">{r.ipa || "—"}</td>
                  <td className="p-2 text-muted-foreground">{r.syllables}</td>
                  <td className="p-2">
                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        r.perplexity < 25
                          ? "text-emerald-500"
                          : r.perplexity < 50
                            ? "text-amber-500"
                            : "text-rose-500"
                      }`}
                    >
                      {r.perplexity.toFixed(1)}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onPlayName(r.name, r.ipa)}
                        title="Listen to pronunciation"
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-[#0091ff] transition-colors cursor-pointer"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopy(r.name)}
                        title="Copy to clipboard"
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                      >
                        {copiedName === r.name ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
