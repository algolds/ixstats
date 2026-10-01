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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import { Slider } from "~/components/ui/slider";
import { Checkbox } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";

type Sorting = BatchResultsTableProps["sorting"];

function ariaSort(sorting: Sorting, column: keyof BatchNameResult) {
  if (sorting.column !== column) return "none" as const;
  return sorting.direction === "asc" ? ("ascending" as const) : ("descending" as const);
}

/** A sort toggle for a column header: a `ghost` button; the header cell carries `aria-sort`. */
function SortButton({
  column,
  label,
  sorting,
  onSort,
}: {
  column: keyof BatchNameResult;
  label: string;
  sorting: Sorting;
  onSort: (col: keyof BatchNameResult) => void;
}) {
  const active = sorting.column === column;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort(column)}
      className={cn(
        "text-footnote -ml-2 gap-1 px-2",
        active ? "text-tint" : "text-label hover:text-tint"
      )}
    >
      {label}
      {active && <span aria-hidden>{sorting.direction === "asc" ? "↑" : "↓"}</span>}
    </Button>
  );
}

function SortableHead(props: React.ComponentProps<typeof SortButton>) {
  return (
    <TableHead aria-sort={ariaSort(props.sorting, props.column)}>
      <SortButton {...props} />
    </TableHead>
  );
}

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
          <div className="text-label-secondary text-footnote flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span>Max Perplexity:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="What is Perplexity?"
                    className="text-label-secondary hover:text-label cursor-help"
                  >
                    <HelpCircle className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-footnote max-w-xs space-y-2 p-3">
                  <p className="text-label font-semibold">Perplexity (Linguistic Surprise)</p>
                  <p className="text-label-secondary text-caption leading-relaxed">
                    Measures how unexpected or unusual a word&apos;s letter transitions are relative
                    to the training phonology model.
                  </p>
                  <div className="border-separator text-caption grid grid-cols-2 gap-2 border-t pt-1 font-mono">
                    <span className="text-green font-medium">&lt; 25: Natural & familiar</span>
                    <span className="text-yellow font-medium">25–50: Balanced</span>
                    <span className="text-red col-span-2 font-medium">
                      &gt; 50: Exotic & unusual transitions
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <Slider
              min={0}
              max={100}
              value={[Number(perplexityFilter)]}
              onValueChange={([v = 0]) => onPerplexityChange(v)}
              aria-label="Maximum perplexity"
              className="w-20"
            />
            <span className="text-tint text-caption font-mono font-semibold">
              {perplexityFilter > 0 ? `< ${perplexityFilter}` : "All"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedNames.size > 0 && (
            <Button variant="tinted" size="sm" onClick={onBulkSave}>
              <Bookmark className="h-3.5 w-3.5" /> Save Selected ({selectedNames.size})
            </Button>
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
      <Table containerClassName="max-h-[500px]">
        <TableHeader sticky>
          <TableRow>
            <TableHead className="w-8 text-center">
              <Checkbox
                checked={results.length > 0 && selectedNames.size === results.length}
                onCheckedChange={() => onSelectAll()}
                aria-label="Select all names"
              />
            </TableHead>
            <SortableHead column="name" label="Name" sorting={sorting} onSort={onSort} />
            <TableHead className="text-label">IPA Transcription</TableHead>
            <SortableHead column="syllables" label="Syllables" sorting={sorting} onSort={onSort} />
            <TableHead aria-sort={ariaSort(sorting, "perplexity")}>
              <div className="flex items-center gap-1">
                <SortButton
                  column="perplexity"
                  label="Perplexity"
                  sorting={sorting}
                  onSort={onSort}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="What is Perplexity?"
                      className="text-label-secondary hover:text-label cursor-help"
                    >
                      <HelpCircle className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-footnote max-w-xs space-y-2 p-3">
                    <p className="text-label font-semibold">Perplexity (Linguistic Surprise)</p>
                    <p className="text-label-secondary text-caption leading-relaxed">
                      Measures how unexpected or unusual a word&apos;s letter transitions are
                      relative to the training phonology model.
                    </p>
                    <div className="border-separator text-caption grid grid-cols-2 gap-2 border-t pt-1 font-mono">
                      <span className="text-green font-medium">&lt; 25: Natural & familiar</span>
                      <span className="text-yellow font-medium">25–50: Balanced</span>
                      <span className="text-red col-span-2 font-medium">
                        &gt; 50: Exotic & unusual transitions
                      </span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r, i) => {
            const isSelected = selectedNames.has(r.name);
            return (
              <TableRow
                key={r.name + i}
                className={`hover:bg-fill-4 transition-colors ${isSelected ? "bg-tint/5" : ""}`}
              >
                <TableCell className="p-2 text-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onSelectName(r.name)}
                    aria-label={`Select ${r.name}`}
                  />
                </TableCell>
                <TableCell className="text-label p-2 font-semibold">{r.name}</TableCell>
                <TableCell className="text-label-secondary p-2 font-mono">{r.ipa || "—"}</TableCell>
                <TableCell className="text-label-secondary p-2">{r.syllables}</TableCell>
                <TableCell className="p-2">
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
                </TableCell>
                <TableCell className="p-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onPlayName(r.name, r.ipa)}
                      title="Listen to pronunciation"
                      aria-label="Listen to pronunciation"
                      className="text-label-secondary hover:text-tint"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleCopy(r.name)}
                      title="Copy to clipboard"
                      aria-label="Copy to clipboard"
                      className="text-label-secondary hover:text-label"
                    >
                      {copiedName === r.name ? (
                        <Check className="text-green h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
