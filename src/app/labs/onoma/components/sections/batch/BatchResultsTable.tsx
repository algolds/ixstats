"use client";

// src/app/labs/onoma/components/sections/batch/BatchResultsTable.tsx
// Results data table with sorting, search filtering, audio synthesis, and bulk stash actions

import React, { useState } from "react";
import {
  SoundHigh as Volume2,
  Bookmark,
  Download as FileDown,
  Copy,
  Check,
  HelpCircle,
} from "iconoir-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import type { BatchNameResult } from "./batch-constants";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

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
      <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="Search generated names..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="text-footnote"
          />
          <div className="text-label-secondary text-footnote flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <span>Max Perplexity:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-label-secondary hover:text-label inline-flex cursor-help items-center transition-colors focus:outline-none"
                    aria-label="What is Perplexity?"
                  >
                    <HelpCircle className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-footnote max-w-xs space-y-1.5 p-3">
                  <p className="text-label font-semibold">Perplexity (Linguistic Surprise)</p>
                  <p className="text-label-secondary text-caption leading-relaxed">
                    Measures how unexpected or unusual a word&apos;s letter transitions are relative
                    to the training phonology model.
                  </p>
                  <div className="border-separator text-caption grid grid-cols-2 gap-1.5 border-t pt-1 font-mono">
                    <span className="text-green font-medium">&lt; 25: Natural & familiar</span>
                    <span className="text-yellow font-medium">25–50: Balanced</span>
                    <span className="text-red col-span-2 font-medium">
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
              className="accent-tint w-20"
            />
            <span className="text-tint text-caption font-mono font-semibold">
              {perplexityFilter > 0 ? `< ${perplexityFilter}` : "All"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedNames.size > 0 && (
            <button
              onClick={onBulkSave}
              className="rounded-control border-indigo/30 bg-indigo/10 text-footnote text-indigo hover:bg-indigo/20 flex cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-semibold"
            >
              <Bookmark className="h-3.5 w-3.5" /> Save Selected ({selectedNames.size})
            </button>
          )}
          <Button variant="bordered" size="sm" onClick={onExportCSV}>
            <FileDown className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="bordered" size="sm" onClick={onExportJSON}>
            <FileDown className="h-3.5 w-3.5" /> JSON
          </Button>
        </div>
      </div>

      {/* Results table */}
      <div className="border-separator rounded-control max-h-[500px] overflow-y-auto border">
        <table className="text-footnote w-full text-left">
          <thead className="bg-surface border-separator sticky top-0 border-b">
            <tr>
              <th className="w-8 p-2 text-center">
                <input
                  type="checkbox"
                  checked={results.length > 0 && selectedNames.size === results.length}
                  onChange={onSelectAll}
                  className="border-separator accent-tint rounded-control-sm cursor-pointer"
                />
              </th>
              <th
                onClick={() => onSort("name")}
                className="text-label hover:text-tint cursor-pointer p-2 font-semibold"
              >
                Name {sorting.column === "name" && (sorting.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="text-label p-2 font-semibold">IPA Transcription</th>
              <th
                onClick={() => onSort("syllables")}
                className="text-label hover:text-tint cursor-pointer p-2 font-semibold"
              >
                Syllables{" "}
                {sorting.column === "syllables" && (sorting.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="text-label p-2 font-semibold">
                <div className="flex items-center gap-1">
                  <span
                    onClick={() => onSort("perplexity")}
                    className="hover:text-tint cursor-pointer"
                  >
                    Perplexity{" "}
                    {sorting.column === "perplexity" && (sorting.direction === "asc" ? "↑" : "↓")}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-label-secondary hover:text-label inline-flex cursor-help items-center transition-colors focus:outline-none"
                        aria-label="What is Perplexity?"
                      >
                        <HelpCircle className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-footnote max-w-xs space-y-1.5 p-3">
                      <p className="text-label font-semibold">Perplexity (Linguistic Surprise)</p>
                      <p className="text-label-secondary text-caption leading-relaxed">
                        Measures how unexpected or unusual a word&apos;s letter transitions are
                        relative to the training phonology model.
                      </p>
                      <div className="border-separator text-caption grid grid-cols-2 gap-1.5 border-t pt-1 font-mono">
                        <span className="text-green font-medium">&lt; 25: Natural & familiar</span>
                        <span className="text-yellow font-medium">25–50: Balanced</span>
                        <span className="text-red col-span-2 font-medium">
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
          <tbody className="divide-separator divide-y">
            {results.map((r, i) => {
              const isSelected = selectedNames.has(r.name);
              return (
                <tr
                  key={r.name + i}
                  className={`hover:bg-fill-4 transition-colors ${isSelected ? "bg-tint/5" : ""}`}
                >
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectName(r.name)}
                      className="border-separator accent-tint rounded-control-sm cursor-pointer"
                    />
                  </td>
                  <td className="text-label p-2 font-semibold">{r.name}</td>
                  <td className="text-label-secondary p-2 font-mono">{r.ipa || "—"}</td>
                  <td className="text-label-secondary p-2">{r.syllables}</td>
                  <td className="p-2">
                    <span
                      className={`text-caption font-mono font-semibold ${
                        r.perplexity < 25
                          ? "text-green"
                          : r.perplexity < 50
                            ? "text-yellow"
                            : "text-red"
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
                        className="text-label-secondary hover:bg-fill-2 hover:text-tint rounded-control-sm cursor-pointer p-1 transition-colors"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopy(r.name)}
                        title="Copy to clipboard"
                        className="text-label-secondary hover:bg-fill-2 hover:text-label rounded-control-sm cursor-pointer p-1 transition-colors"
                      >
                        {copiedName === r.name ? (
                          <Check className="text-green h-3.5 w-3.5" />
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
