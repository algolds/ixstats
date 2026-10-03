"use client";

import { useRef, useState } from "react";
import type { CardRarity } from "@prisma/client";
import {
  Download,
  Globe,
  OpenBook as BookOpen,
  Page as FileText,
  Search,
  SystemRestart as Loader2,
  ControlSlider as Sliders,
  Upload,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { CATEGORY_PRESETS } from "./category-presets";
import type { useLoreBatchLoaders } from "./useLoreBatchLoaders";
import type { useLoreBatchQueue } from "./useLoreBatchQueue";

const SOURCE_OPTIONS = [
  ["ixwiki", "IxWiki (Primary)"],
  ["iiwiki", "IIWiki (Secondary)"],
] as const;

const RARITY_OPTIONS = [
  ["AUTO", "Auto (AI-determined)"],
  ["COMMON", "Common"],
  ["UNCOMMON", "Uncommon"],
  ["RARE", "Rare"],
  ["ULTRA_RARE", "Ultra rare"],
  ["EPIC", "Epic"],
  ["LEGENDARY", "Legendary"],
] as const;

const SEASON_OPTIONS = [1, 2, 3].map((n) => [String(n), `Season ${n}`] as const);

/** Shown for the IXWB preset until the wiki reports its live category size. */
const IXWB_FALLBACK_COUNT = 3371;

interface ParamSelectProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
}

function ParamSelect<T extends string>({ label, value, onChange, options }: ParamSelectProps<T>) {
  return (
    <div>
      <label className="text-label-secondary text-caption mb-1 block">{label}</label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface BatchControlsProps {
  queue: ReturnType<typeof useLoreBatchQueue>;
  loaders: ReturnType<typeof useLoreBatchLoaders>;
}

export function BatchControls({ queue, loaders }: BatchControlsProps) {
  const { wikiSource } = queue;
  const sourceLabel = wikiSource.toUpperCase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [articleInput, setArticleInput] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const trimmedQuery = categoryQuery.trim();

  const { data: searchData } = api.loreCards.searchWikiCategories.useQuery(
    { source: wikiSource, prefix: trimmedQuery, limit: 25 },
    { enabled: trimmedQuery.length > 0 }
  );
  const { data: statsData } = api.loreCards.getCategoryStats.useQuery(
    { source: wikiSource, categories: CATEGORY_PRESETS.map((p) => p.categoryName) },
    { staleTime: 60 * 1000 }
  );
  const categoryStats: Record<string, { size: number; pages: number; files: number }> | undefined =
    statsData?.stats;

  const crawlCategory = async (name: string) => {
    if (await loaders.crawlCategory(name)) {
      setCategoryQuery("");
      setIsDropdownOpen(false);
    }
  };

  const addFromText = async () => {
    await loaders.addFromText(articleInput);
    setArticleInput("");
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loaders.importFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <Card className="space-y-4 p-4">
        <div className="text-label text-caption flex items-center gap-2">
          <Sliders className="text-purple h-4 w-4" />
          <span>Batch generation parameters</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          <ParamSelect
            label="Default wiki source"
            value={wikiSource}
            onChange={queue.setWikiSource}
            options={SOURCE_OPTIONS}
          />
          <ParamSelect<CardRarity | "AUTO">
            label="Target rarity strategy"
            value={queue.targetRarity}
            onChange={queue.setTargetRarity}
            options={RARITY_OPTIONS}
          />
          <ParamSelect
            label="Target card season"
            value={String(queue.season)}
            onChange={(v) => queue.setSeason(parseInt(v, 10))}
            options={SEASON_OPTIONS}
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-secondary text-caption flex items-center gap-1">
            <BookOpen className="text-yellow h-3 w-3" /> Category Presets:
          </span>
          {CATEGORY_PRESETS.filter(
            (preset) => !preset.wikiSourceFilter || preset.wikiSourceFilter === wikiSource
          ).map((preset) => {
            const Icon = preset.icon;
            const isCrawling = loaders.crawlingPresetName === preset.name;
            const stats =
              categoryStats?.[preset.categoryName] ??
              categoryStats?.[`Category:${preset.categoryName}`];
            const liveCount = stats
              ? stats.size || stats.pages + stats.files
              : preset.categoryName === "IXWB"
                ? IXWB_FALLBACK_COUNT
                : preset.terms.length;

            return (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                disabled={Boolean(loaders.crawlingPresetName)}
                onClick={() => loaders.applyPreset(preset)}
                title={`Add all ${liveCount.toLocaleString()} verified ${preset.name} articles & files to batch queue\nCategory: Category:${preset.categoryName}\nSynonyms & Keywords: ${preset.synonyms.slice(0, 10).join(", ")}...`}
              >
                {isCrawling ? (
                  <Loader2 className="text-purple h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="text-purple h-3.5 w-3.5" />
                )}
                <span>{preset.name}</span>
                <Badge variant="default" className="tabular-nums">
                  {isCrawling ? "Crawling..." : liveCount.toLocaleString()}
                </Badge>
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={importFile}
            className="hidden"
          />
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-3.5 w-3.5" /> Import CSV/JSON
          </Button>
          {queue.candidates.length > 0 && (
            <Button size="sm" variant="outline" onClick={queue.exportJson}>
              <Download className="mr-2 h-3.5 w-3.5" /> Export JSON
            </Button>
          )}
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <div className="relative flex items-center">
              <Search className="text-label-secondary absolute left-3 h-3.5 w-3.5" />
              <Input
                value={categoryQuery}
                onChange={(e) => {
                  setCategoryQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder={`Search ${sourceLabel} categories (e.g. IXWB, Countries, Wars, Treaties)...`}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) pr-24 pl-9"
              />
              {trimmedQuery && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={loaders.isCrawlingCategory}
                  onClick={() => crawlCategory(categoryQuery)}
                  className="absolute right-1"
                >
                  {loaders.isCrawlingCategory ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <BookOpen className="mr-1 h-3 w-3" />
                  )}
                  Crawl
                </Button>
              )}
            </div>

            {isDropdownOpen && searchData?.categories && searchData.categories.length > 0 && (
              <div className="border-separator bg-surface-elevated rounded-row shadow-floating absolute top-10 right-0 left-0 z-50 max-h-48 overflow-y-auto border p-2">
                <div className="text-label-secondary border-separator text-caption flex items-center justify-between border-b px-2 pb-1">
                  <span>Matching {sourceLabel} Categories</span>
                  <Button size="sm" variant="ghost" onClick={() => setIsDropdownOpen(false)}>
                    Close
                  </Button>
                </div>
                <FacetListSection variant="plain" aria-label={`Matching ${sourceLabel} categories`}>
                  {searchData.categories.map((cat) => (
                    <FacetRow
                      key={cat}
                      onClick={() => crawlCategory(cat)}
                      leading={<BookOpen aria-hidden className="text-purple size-3.5" />}
                      title={cat}
                      trailing={
                        <span className="text-label-secondary text-footnote">Crawl Category →</span>
                      }
                    />
                  ))}
                </FacetListSection>
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="secondary"
            disabled={loaders.isCrawlingAllPages}
            onClick={loaders.crawlAllMainPages}
            title={`Fetch all articles in the main namespace (namespace 0) on ${sourceLabel}`}
            className="shrink-0"
          >
            {loaders.isCrawlingAllPages ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Globe className="text-purple mr-2 h-3.5 w-3.5" />
            )}
            Parse All {sourceLabel} Main Pages (Namespace 0)
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <label className="text-label text-caption flex items-center gap-2">
            <FileText className="text-tint h-4 w-4" />
            Add Articles & Categories to Queue (Comma or Newline Separated)
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={addFromText}
            disabled={!articleInput.trim()}
          >
            Add to queue
          </Button>
        </div>
        <Textarea
          value={articleInput}
          onChange={(e) => setArticleInput(e.target.value)}
          placeholder="e.g. Caphiria, Daxia, Category:IXWB, Category:Wars, Category:Treaties, Urcea..."
          className="h-20 w-full"
        />
        <p className="text-label-secondary text-footnote">
          💡 Supports individual article titles, comma-separated lists, and{" "}
          <code className="rounded-control-sm bg-purple/10 text-purple px-1 py-0.5 tabular-nums">
            Category:&lt;Name&gt;
          </code>{" "}
          to automatically crawl and load all member pages.
        </p>
      </Card>
    </>
  );
}
