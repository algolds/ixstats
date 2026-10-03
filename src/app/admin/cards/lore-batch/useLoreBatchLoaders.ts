import { useState } from "react";
import type { CardRarity } from "@prisma/client";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { CATEGORY_PRESETS } from "./category-presets";
import { errorMessageOf, type CandidateSeed } from "./useLoreBatchQueue";
import type { BatchCandidate } from "./types";

type CategoryPreset = (typeof CATEGORY_PRESETS)[number];

interface ImportedItem {
  title?: string;
  articleTitle?: string;
  wikiSource?: string;
  targetRarity?: CardRarity;
  season?: number;
  customPrompt?: string;
}

const stripCategoryPrefix = (name: string) => name.replace(/^category:\s*/i, "").trim();

type SeedDefaults = Pick<BatchCandidate, "wikiSource" | "targetRarity" | "season">;

function parseJsonSeeds(text: string, defaults: SeedDefaults): CandidateSeed[] {
  const parsed = JSON.parse(text) as ImportedItem | ImportedItem[];
  return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
    articleTitle: item.title || item.articleTitle || "Untitled Article",
    wikiSource: item.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki",
    targetRarity: item.targetRarity || defaults.targetRarity,
    season: item.season || defaults.season,
    customPrompt: item.customPrompt || undefined,
  }));
}

/** CSV rows are `title[,source[,rarity[,season[,prompt]]]]`; a header row is skipped. */
function parseCsvSeeds(text: string, defaults: SeedDefaults): CandidateSeed[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, "")))
    .filter(([title]) => title && !["title", "articletitle"].includes(title.toLowerCase()))
    .map(([title, source, rarity, seasonText, prompt]) => ({
      articleTitle: title!,
      wikiSource: source === "iiwiki" ? "iiwiki" : defaults.wikiSource,
      targetRarity: (rarity as CardRarity) || defaults.targetRarity,
      season: parseInt(seasonText ?? "", 10) || defaults.season,
      customPrompt: prompt || undefined,
    }));
}

interface LoaderQueue extends SeedDefaults {
  addCandidates: (seeds: CandidateSeed[]) => number;
}

/** The ways of filling the queue: wiki category and namespace crawls, presets, text and files. */
export function useLoreBatchLoaders(queue: LoaderQueue) {
  const { wikiSource, targetRarity, season, addCandidates } = queue;
  const notify = useNotify();
  const utils = api.useUtils();
  const [isCrawlingCategory, setIsCrawlingCategory] = useState(false);
  const [isCrawlingAllPages, setIsCrawlingAllPages] = useState(false);
  const [crawlingPresetName, setCrawlingPresetName] = useState<string | null>(null);

  const fetchCategoryTitles = async (category: string, limit: number) => {
    const res = await utils.loreCards.fetchWikiCategoryMembers.fetch({
      source: wikiSource,
      category,
      limit,
    });
    return res.titles ?? [];
  };

  const crawlCategory = async (categoryName: string): Promise<boolean> => {
    const category = stripCategoryPrefix(categoryName);
    if (!category) return false;

    setIsCrawlingCategory(true);
    try {
      const titles = await fetchCategoryTitles(category, 10000);
      if (titles.length === 0) {
        notify.info(
          "No Articles Found",
          `No namespace-0 articles found in Category:${category} on ${wikiSource}.`
        );
        return false;
      }
      const added = addCandidates(
        titles.map((articleTitle) => ({ articleTitle, customPrompt: `Category:${category}` }))
      );
      notify.success(
        "Category Loaded",
        `Added ${added.toLocaleString()} articles & files from Category:${category} on ${wikiSource.toUpperCase()} to queue.`
      );
      return true;
    } catch (err) {
      notify.error(
        "Category Crawl Failed",
        errorMessageOf(err, "Failed to fetch category members.")
      );
      return false;
    } finally {
      setIsCrawlingCategory(false);
    }
  };

  const crawlAllMainPages = async () => {
    setIsCrawlingAllPages(true);
    try {
      const res = await utils.loreCards.fetchAllMainNamespacePages.fetch({
        source: wikiSource,
        limit: 1000,
      });
      if (!res.titles?.length) {
        notify.info("No Pages Found", `No main namespace (0) pages found on ${wikiSource}.`);
        return;
      }
      const added = addCandidates(res.titles.map((articleTitle) => ({ articleTitle })));
      notify.success(
        "Main Pages Loaded",
        `Loaded ${added} namespace-0 articles from ${wikiSource.toUpperCase()} into batch queue.`
      );
    } catch (err) {
      notify.error(
        "Namespace 0 Crawl Failed",
        errorMessageOf(err, "Failed to fetch all namespace 0 pages.")
      );
    } finally {
      setIsCrawlingAllPages(false);
    }
  };

  /** Adds titles from free text; `Category:<Name>` lines are expanded to their member pages. */
  const addFromText = async (text: string) => {
    const lines = text
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const categories: string[] = [];
    const seeds: CandidateSeed[] = [];
    for (const line of lines) {
      if (!/^category:\s*/i.test(line)) {
        seeds.push({ articleTitle: line });
      } else if (stripCategoryPrefix(line)) {
        categories.push(stripCategoryPrefix(line));
      }
    }
    for (const category of categories) {
      try {
        const titles = await fetchCategoryTitles(category, 500);
        seeds.push(
          ...titles.map((articleTitle) => ({ articleTitle, customPrompt: `Category:${category}` }))
        );
      } catch (err) {
        console.warn(`Failed to crawl category "${category}":`, err);
      }
    }
    addCandidates(seeds);
    if (seeds.length > 0) {
      notify.success("Articles Added", `Added ${seeds.length} candidate(s) to the batch queue.`);
    } else {
      notify.info("No Articles Found", "No valid articles or category members could be added.");
    }
  };

  const applyPreset = async (preset: CategoryPreset) => {
    const customPrompt = preset.name;
    const queueTerms = (terms: string[], what: string) => {
      const added = addCandidates(terms.map((articleTitle) => ({ articleTitle, customPrompt })));
      notify.success(
        "Preset Applied",
        `Loaded ${added.toLocaleString()} ${what} from "${preset.name}".`
      );
    };

    setCrawlingPresetName(preset.name);
    try {
      const live = await fetchCategoryTitles(preset.categoryName, 10000);
      // Seed terms are merged in so verified items are always included.
      const known = new Set(live.map((t) => t.toLowerCase()));
      const titles = live.length
        ? [...live, ...preset.terms.filter((term) => !known.has(term.toLowerCase()))]
        : [...preset.terms];
      if (titles.length === 0) {
        notify.info("No Articles Found", `No articles found for preset "${preset.name}".`);
        return;
      }
      queueTerms(titles, "articles & files");
    } catch {
      queueTerms(preset.terms, "canonical articles");
    } finally {
      setCrawlingPresetName(null);
    }
  };

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const isJson = file.name.endsWith(".json");
        const defaults = { wikiSource, targetRarity, season };
        const seeds = isJson ? parseJsonSeeds(text, defaults) : parseCsvSeeds(text, defaults);
        addCandidates(seeds);
        const kind = isJson ? "JSON" : "CSV";
        notify.success(`${kind} Imported`, `Imported ${seeds.length} candidates from ${kind}.`);
      } catch {
        notify.error("Import Error", "Failed to parse file. Ensure valid JSON or CSV format.");
      }
    };
    reader.readAsText(file);
  };

  return {
    isCrawlingCategory,
    isCrawlingAllPages,
    crawlingPresetName,
    crawlCategory,
    crawlAllMainPages,
    addFromText,
    applyPreset,
    importFile,
  };
}
