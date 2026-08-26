// src/app/admin/cards/LoreCardBatchAdmin.tsx
// Unified Theme-Compliant Apple Design Lore Card Batch Generator & User Request Queue
"use client";

import { useState, useRef, useMemo } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Download, Search, Xmark as X, WarningCircle as AlertCircle, WarningTriangle as AlertTriangle, OpenBook as BookOpen, Globe, SystemRestart as Loader2, CheckCircle as CheckCircle2, XmarkCircle as XCircle, Clock, Upload, UserBadgeCheck as UserCheck, ControlSlider as Sliders, Component as Layers, Page as FileText, Trash as Trash2, Play, Page as Scroll, Sparks as Sparkles, MediaImage as ImageIcon, Eye, Copy, OpenNewWindow as ExternalLink, Undo as RotateCcw, InfoCircle as Info } from "iconoir-react";
import type { CardRarity } from "@prisma/client";
import type { CardAuthorInfo } from "~/types/cards-display";
import { IIWikiBadge } from "~/components/cards/display";

import { CATEGORY_PRESETS } from "./lore-batch/category-presets";

export { CATEGORY_PRESETS };


interface BatchCandidate {
  id: string;
  articleTitle: string;
  wikiSource: "ixwiki" | "iiwiki";
  targetRarity: CardRarity | "AUTO";
  season: number;
  customPrompt?: string;
  imageUrl?: string | null;
  extract?: string;
  category?: string;
  authorInfo?: CardAuthorInfo | null;
  author?: string;
  status: "idle" | "generating" | "success" | "error";
  errorMessage?: string;
  generatedCardId?: string;
  mintedArtwork?: string | null;
}

export function LoreCardBatchAdmin() {
  const notify = useNotify();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"generator" | "requests">("generator");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("ALL");

  // Generator parameters
  const [articleInput, setArticleInput] = useState("");
  const [globalWikiSource, setGlobalWikiSource] = useState<"ixwiki" | "iiwiki">("ixwiki");
  const [globalTargetRarity, setGlobalTargetRarity] = useState<CardRarity | "AUTO">("AUTO");
  const [globalSeason, setGlobalSeason] = useState<number>(1);
  const [globalPromptModifier, _setGlobalPromptModifier] = useState("");

  // Batch candidate queue
  const [candidates, setCandidates] = useState<BatchCandidate[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<
    "ALL" | "idle" | "generating" | "success" | "error"
  >("ALL");
  const [selectedErrorCandidate, setSelectedErrorCandidate] = useState<BatchCandidate | null>(null);

  // Computed queue metrics
  const idleCount = useMemo(
    () => candidates.filter((c) => c.status === "idle").length,
    [candidates]
  );
  const generatingCount = useMemo(
    () => candidates.filter((c) => c.status === "generating").length,
    [candidates]
  );
  const successCount = useMemo(
    () => candidates.filter((c) => c.status === "success").length,
    [candidates]
  );
  const errorCount = useMemo(
    () => candidates.filter((c) => c.status === "error").length,
    [candidates]
  );

  const filteredCandidates = useMemo(() => {
    if (candidateStatusFilter === "ALL") return candidates;
    return candidates.filter((c) => c.status === candidateStatusFilter);
  }, [candidates, candidateStatusFilter]);

  // Lightbox modal for previewing artwork on click
  const [previewImage, setPreviewImage] = useState<{
    title: string;
    imageUrl: string;
    extract?: string;
    wikiSource?: string;
    category?: string;
    rarity?: string;
    season?: number;
    author?: string;
  } | null>(null);

  // Duplicate purging modal
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState(false);

  // Author backfill modal
  const [isBackfillDialogOpen, setIsBackfillDialogOpen] = useState(false);
  const [backfillLimit, setBackfillLimit] = useState(100);
  const [backfillSource, setBackfillSource] = useState<"all" | "ixwiki" | "iiwiki">("all");

  // Re-classify categories modal
  const [isReclassifyDialogOpen, setIsReclassifyDialogOpen] = useState(false);
  const [reclassifyLimit, setReclassifyLimit] = useState(100);
  const [reclassifySource, setReclassifySource] = useState<"all" | "ixwiki" | "iiwiki">("all");
  const [reclassifyForce, setReclassifyForce] = useState(false);

  // Rejection modal
  const [rejectionRequestId, setRejectionRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = api.useUtils();

  // Duplicate cards statistics
  const { data: duplicateStats, refetch: refetchDuplicates } =
    api.loreCards.getDuplicateCardsStats.useQuery();

  const purgeDuplicatesMutation = api.loreCards.purgeDuplicateCards.useMutation({
    onSuccess: (data: { message: string }) => {
      notify.success("Duplicates Purged", data.message);
      setIsPurgeDialogOpen(false);
      void refetchDuplicates();
      void utils.cards.getUnifiedAuditLogs.invalidate();
      void utils.cards.getLoreStats.invalidate();
    },
    onError: (err: { message: string }) => notify.error("Purge Error", err.message),
  });

  const backfillAuthorsMutation = api.loreCards.backfillWikiAuthors.useMutation({
    onSuccess: (data: { count: number; message: string }) => {
      notify.success("Authors Backfilled", data.message);
      setIsBackfillDialogOpen(false);
      void utils.cards.getUnifiedAuditLogs.invalidate();
      void utils.cards.getLoreStats.invalidate();
    },
    onError: (err: { message: string }) => notify.error("Backfill Error", err.message),
  });

  const reclassifyCategoriesMutation = api.loreCards.reclassifyLoreCards.useMutation({
    onSuccess: (data: { processedCount: number; reclassifiedCount: number; message: string }) => {
      notify.success("Categories Re-Cataloged", data.message);
      setIsReclassifyDialogOpen(false);
      void utils.cards.getUnifiedAuditLogs.invalidate();
      void utils.cards.getLoreStats.invalidate();
    },
    onError: (err: { message: string }) => notify.error("Re-Catalog Error", err.message),
  });

  // Deduplicate in-memory queue
  const handleDeduplicateQueue = () => {
    const seen = new Set<string>();
    let removed = 0;
    const deduplicated: BatchCandidate[] = [];
    for (const c of candidates) {
      const key = `${c.wikiSource}:${c.articleTitle.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(c);
      } else {
        removed++;
      }
    }
    setCandidates(deduplicated);
    if (removed > 0) {
      notify.success(
        "Queue Deduplicated",
        `Removed ${removed} redundant duplicate item(s) from candidate queue.`
      );
    } else {
      notify.info("Queue Clean", "No duplicate items found in candidate queue.");
    }
  };

  // Asynchronously enrich candidate image thumbnails
  const enrichCandidateThumbnails = async (newItems: BatchCandidate[]) => {
    const titlesToEnrich = newItems.filter((c) => !c.imageUrl).map((c) => c.articleTitle);
    if (titlesToEnrich.length === 0) return;
    try {
      const res = await utils.loreCards.fetchArticlePreviewsBatch.fetch({
        titles: titlesToEnrich.slice(0, 100),
        source: globalWikiSource,
      });
      if (res.previews && res.previews.length > 0) {
        const previewMap = new Map(res.previews.map((p) => [p.title.toLowerCase(), p]));
        setCandidates((prev) =>
          prev.map((c) => {
            const p = previewMap.get(c.articleTitle.toLowerCase());
            if (p) {
              return {
                ...c,
                imageUrl: p.imageUrl || c.imageUrl || null,
                extract: p.extract || c.extract,
                category: c.category || p.category,
                authorInfo: p.authorInfo || null,
                author: p.authorInfo?.displayAuthor,
              };
            }
            return c;
          })
        );
      }
    } catch (e) {
      console.warn("Thumbnail enrichment failed:", e);
    }
  };

  // tRPC queries
  const requestStats = api.loreCards.getRequestStats.useQuery(undefined, {
    enabled: activeTab === "requests",
  });

  const statusParam = requestStatusFilter === "ALL" ? undefined : (requestStatusFilter as any);
  const requestQueue = api.loreCards.getRequestQueue.useQuery(
    { status: statusParam, limit: 50 },
    { enabled: activeTab === "requests" }
  );

  // Mutations
  const approveMutation = api.loreCards.approveRequest.useMutation({
    onSuccess: (data) => {
      notify.success("Request Approved", data.message || "Request approved.");
      void utils.loreCards.getRequestQueue.invalidate();
      void utils.loreCards.getRequestStats.invalidate();
    },
    onError: (err) => notify.error("Approval Error", err.message),
  });

  const rejectMutation = api.loreCards.rejectRequest.useMutation({
    onSuccess: (data) => {
      notify.info("Request Rejected", data.message || "Request rejected and user refunded.");
      setRejectionRequestId(null);
      setRejectionReason("");
      void utils.loreCards.getRequestQueue.invalidate();
      void utils.loreCards.getRequestStats.invalidate();
    },
    onError: (err) => notify.error("Rejection Error", err.message),
  });

  const generateRequestedMutation = api.loreCards.generateRequestedCard.useMutation({
    onSuccess: (data) => {
      notify.success("Lore Card Minted", data.message || "Lore card generated successfully.");
      void utils.loreCards.getRequestQueue.invalidate();
      void utils.loreCards.getRequestStats.invalidate();
    },
    onError: (err) => notify.error("Generation Error", err.message),
  });

  const generateCardMutation = api.loreCards.generateLoreCard.useMutation();

  // Category Search & Live Crawler State
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isCrawlingCategory, setIsCrawlingCategory] = useState(false);
  const [isCrawlingAllPages, setIsCrawlingAllPages] = useState(false);
  const [crawlingPresetName, setCrawlingPresetName] = useState<string | null>(null);

  const { data: categorySearchData, isFetching: _isSearchingCategories } =
    api.loreCards.searchWikiCategories.useQuery(
      {
        source: globalWikiSource,
        prefix: categorySearchQuery.trim(),
        limit: 25,
      },
      {
        enabled: categorySearchQuery.trim().length > 0,
      }
    );

  const { data: categoryStatsData } = api.loreCards.getCategoryStats.useQuery(
    {
      source: globalWikiSource,
      categories: CATEGORY_PRESETS.map((p: any) => p.categoryName),
    },
    {
      staleTime: 60 * 1000,
    }
  );

  // Live Category Crawler
  const handleCrawlCategory = async (categoryName: string) => {
    const cleanCat = categoryName.replace(/^category:\s*/i, "").trim();
    if (!cleanCat) return;

    setIsCrawlingCategory(true);
    try {
      const res = await utils.loreCards.fetchWikiCategoryMembers.fetch({
        source: globalWikiSource,
        category: cleanCat,
        limit: 10000,
        type: "page|file",
      });

      if (!res.titles || res.titles.length === 0) {
        notify.info(
          "No Articles Found",
          `No namespace-0 articles found in Category:${cleanCat} on ${globalWikiSource}.`
        );
        return;
      }

      const newCandidates: BatchCandidate[] = res.titles.map((title, i) => ({
        id: `cat-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        articleTitle: title,
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier
          ? `${globalPromptModifier}, Category:${cleanCat}`
          : `Category:${cleanCat}`,
        status: "idle",
      }));

      setCandidates((prev) => [...prev, ...newCandidates]);
      void enrichCandidateThumbnails(newCandidates);
      setCategorySearchQuery("");
      setIsCategoryDropdownOpen(false);
      notify.success(
        "Category Loaded",
        `Added ${newCandidates.length.toLocaleString()} articles & files from Category:${cleanCat} on ${globalWikiSource.toUpperCase()} to queue.`
      );
    } catch (err: any) {
      notify.error("Category Crawl Failed", err?.message || "Failed to fetch category members.");
    } finally {
      setIsCrawlingCategory(false);
    }
  };

  // Crawl All Main Namespace (0) Pages
  const handleCrawlAllMainPages = async () => {
    setIsCrawlingAllPages(true);
    try {
      const res = await utils.loreCards.fetchAllMainNamespacePages.fetch({
        source: globalWikiSource,
        limit: 1000,
      });

      if (!res.titles || res.titles.length === 0) {
        notify.info("No Pages Found", `No main namespace (0) pages found on ${globalWikiSource}.`);
        return;
      }

      const newCandidates: BatchCandidate[] = res.titles.map((title, i) => ({
        id: `allpages-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        articleTitle: title,
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier || undefined,
        status: "idle",
      }));

      setCandidates((prev) => [...prev, ...newCandidates]);
      void enrichCandidateThumbnails(newCandidates);
      notify.success(
        "Main Pages Loaded",
        `Loaded ${newCandidates.length} namespace-0 articles from ${globalWikiSource.toUpperCase()} into batch queue.`
      );
    } catch (err: any) {
      notify.error(
        "Namespace 0 Crawl Failed",
        err?.message || "Failed to fetch all namespace 0 pages."
      );
    } finally {
      setIsCrawlingAllPages(false);
    }
  };

  // Add items from text input (supports standard titles and Category:<Name> format)
  const handleAddArticlesFromText = async () => {
    if (!articleInput.trim()) return;
    const rawLines = articleInput
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const normalTitles: string[] = [];
    const categoryNames: string[] = [];

    for (const line of rawLines) {
      if (/^category:\s*/i.test(line)) {
        const cat = line.replace(/^category:\s*/i, "").trim();
        if (cat) categoryNames.push(cat);
      } else {
        normalTitles.push(line);
      }
    }

    let totalAdded = 0;
    const newCandidates: BatchCandidate[] = [];

    // Add standard articles
    for (let i = 0; i < normalTitles.length; i++) {
      newCandidates.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        articleTitle: normalTitles[i],
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier || undefined,
        status: "idle",
      });
      totalAdded++;
    }

    // Crawl any category lines
    if (categoryNames.length > 0) {
      for (const cat of categoryNames) {
        try {
          const res = await utils.loreCards.fetchWikiCategoryMembers.fetch({
            source: globalWikiSource,
            category: cat,
            limit: 500,
          });
          if (res.titles && res.titles.length > 0) {
            for (let j = 0; j < res.titles.length; j++) {
              newCandidates.push({
                id: `cat-${Date.now()}-${j}-${Math.random().toString(36).slice(2, 6)}`,
                articleTitle: res.titles[j],
                wikiSource: globalWikiSource,
                targetRarity: globalTargetRarity,
                season: globalSeason,
                customPrompt: globalPromptModifier
                  ? `${globalPromptModifier}, Category:${cat}`
                  : `Category:${cat}`,
                status: "idle",
              });
              totalAdded++;
            }
          }
        } catch (catErr: any) {
          console.warn(`Failed to crawl category "${cat}":`, catErr);
        }
      }
    }

    setCandidates((prev) => [...prev, ...newCandidates]);
    void enrichCandidateThumbnails(newCandidates);
    setArticleInput("");
    if (totalAdded > 0) {
      notify.success("Articles Added", `Added ${totalAdded} candidate(s) to the batch queue.`);
    } else {
      notify.info("No Articles Found", "No valid articles or category members could be added.");
    }
  };

  // Preset Crawler Loader - crawls all live category pages & files (up to 10,000)
  const handleApplyPreset = async (preset: (typeof CATEGORY_PRESETS)[number]) => {
    setCrawlingPresetName(preset.name);
    try {
      // 1. Live crawl category from MediaWiki (fetching all pages & files up to 10,000)
      const res = await utils.loreCards.fetchWikiCategoryMembers.fetch({
        source: globalWikiSource,
        category: preset.categoryName,
        limit: 10000,
        type: "page|file",
      });

      let allTitles = res.titles ? [...res.titles] : [];

      // Merge seed terms so verified items are always included
      if (allTitles.length > 0) {
        const titleSet = new Set(allTitles.map((t) => t.toLowerCase()));
        for (const term of preset.terms) {
          if (!titleSet.has(term.toLowerCase())) {
            allTitles.push(term);
          }
        }
      } else {
        // Fallback to canonical terms if live crawl returns empty
        allTitles = [...preset.terms];
      }

      if (allTitles.length === 0) {
        notify.info("No Articles Found", `No articles found for preset "${preset.name}".`);
        return;
      }

      const newCandidates: BatchCandidate[] = allTitles.map((title, i) => ({
        id: `preset-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        articleTitle: title,
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier
          ? `${globalPromptModifier}, ${preset.name}`
          : preset.name,
        status: "idle",
      }));

      setCandidates((prev) => [...prev, ...newCandidates]);
      void enrichCandidateThumbnails(newCandidates);
      notify.success(
        "Preset Applied",
        `Loaded ${newCandidates.length.toLocaleString()} articles & files from "${preset.name}".`
      );
    } catch (_err: any) {
      // Fall back to seed terms on error
      const newCandidates: BatchCandidate[] = preset.terms.map((title: string, i: number) => ({
        id: `preset-${Date.now()}-${i}`,
        articleTitle: title,
        wikiSource: globalWikiSource,
        targetRarity: globalTargetRarity,
        season: globalSeason,
        customPrompt: globalPromptModifier
          ? `${globalPromptModifier}, ${preset.name}`
          : preset.name,
        status: "idle",
      }));
      setCandidates((prev) => [...prev, ...newCandidates]);
      void enrichCandidateThumbnails(newCandidates);
      notify.success(
        "Preset Applied",
        `Loaded ${newCandidates.length.toLocaleString()} canonical articles from "${preset.name}".`
      );
    } finally {
      setCrawlingPresetName(null);
    }
  };

  // CSV/JSON File Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const newCandidates: BatchCandidate[] = list.map((item: any, i) => ({
            id: `json-${Date.now()}-${i}`,
            articleTitle: item.title || item.articleTitle || "Untitled Article",
            wikiSource: item.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki",
            targetRarity: item.targetRarity || globalTargetRarity,
            season: item.season || globalSeason,
            customPrompt: item.customPrompt || globalPromptModifier || undefined,
            status: "idle",
          }));
          setCandidates((prev) => [...prev, ...newCandidates]);
          void enrichCandidateThumbnails(newCandidates);
          notify.success("JSON Imported", `Imported ${newCandidates.length} candidates from JSON.`);
        } else {
          // CSV Parse
          const lines = text.split("\n").filter((l) => l.trim().length > 0);
          const newCandidates: BatchCandidate[] = [];
          lines.forEach((line, i) => {
            const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
            if (
              cols[0] &&
              cols[0].toLowerCase() !== "title" &&
              cols[0].toLowerCase() !== "articletitle"
            ) {
              newCandidates.push({
                id: `csv-${Date.now()}-${i}`,
                articleTitle: cols[0],
                wikiSource: cols[1] === "iiwiki" ? "iiwiki" : globalWikiSource,
                targetRarity: (cols[2] as CardRarity) || globalTargetRarity,
                season: parseInt(cols[3], 10) || globalSeason,
                customPrompt: cols[4] || globalPromptModifier || undefined,
                status: "idle",
              });
            }
          });
          setCandidates((prev) => [...prev, ...newCandidates]);
          void enrichCandidateThumbnails(newCandidates);
          notify.success("CSV Imported", `Imported ${newCandidates.length} candidates from CSV.`);
        }
      } catch (_err) {
        notify.error("Import Error", "Failed to parse file. Ensure valid JSON or CSV format.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Export Batch to JSON
  const handleExportJSON = () => {
    if (candidates.length === 0) return;
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(candidates, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lore_batch_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    notify.success("Batch Exported", "Exported candidates to JSON.");
  };

  // Retry a single failed candidate
  const handleRetryCandidate = async (candidateId: string) => {
    const item = candidates.find((c) => c.id === candidateId);
    if (!item) return;

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId ? { ...c, status: "generating", errorMessage: undefined } : c
      )
    );

    try {
      const res = await generateCardMutation.mutateAsync({
        articleTitle: item.articleTitle,
        wikiSource: item.wikiSource,
        targetRarity: item.targetRarity !== "AUTO" ? item.targetRarity : undefined,
        customPrompt: item.customPrompt,
      });

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? {
                ...c,
                status: "success",
                generatedCardId: res.cardId,
                mintedArtwork: (res as any).artworkUrl || item.imageUrl || null,
                errorMessage: undefined,
              }
            : c
        )
      );
      notify.success("Card Minted", `Successfully minted lore card for "${item.articleTitle}".`);
    } catch (err: any) {
      const errorMsg = err?.message || "Generation failed";
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, status: "error", errorMessage: errorMsg } : c
        )
      );
      notify.error("Retry Failed", errorMsg);
    }
  };

  // Reset all failed candidates back to idle and process batch
  const handleRetryAllFailed = async () => {
    const failedItems = candidates.filter((c) => c.status === "error");
    if (failedItems.length === 0) {
      notify.info("No Failed Candidates", "There are no failed items in the queue to retry.");
      return;
    }

    setCandidates((prev) =>
      prev.map((c) =>
        c.status === "error" ? { ...c, status: "idle", errorMessage: undefined } : c
      )
    );
    notify.info(
      "Resetting Failed Items",
      `Reset ${failedItems.length} candidate(s) to queued status.`
    );
  };

  // Clear only failed candidates from queue
  const handleClearFailed = () => {
    const count = candidates.filter((c) => c.status === "error").length;
    setCandidates((prev) => prev.filter((c) => c.status !== "error"));
    notify.info(
      "Failed Candidates Cleared",
      `Removed ${count} failed candidate(s) from the queue.`
    );
  };

  // Copy error report of failed candidates
  const handleCopyErrorReport = () => {
    const failedItems = candidates.filter((c) => c.status === "error");
    if (failedItems.length === 0) {
      notify.info("No Errors", "No failed candidates in the queue.");
      return;
    }

    const report = [
      `# Lore Card Import Failure Report (${new Date().toLocaleString()})`,
      `Total Failures: ${failedItems.length}`,
      "",
      ...failedItems.map(
        (c, i) =>
          `${i + 1}. [${c.wikiSource.toUpperCase()}] "${c.articleTitle}" — Error: ${c.errorMessage || "Unknown generation error"}`
      ),
    ].join("\n");

    void navigator.clipboard.writeText(report);
    notify.success(
      "Error Report Copied",
      `Copied diagnostic details for ${failedItems.length} failed articles to clipboard.`
    );
  };

  // Process Entire Batch
  const handleProcessBatch = async () => {
    const idleCandidates = candidates.filter((c) => c.status === "idle");
    if (idleCandidates.length === 0) {
      notify.info("No Idle Candidates", "Add candidates to the queue or reset failed ones.");
      return;
    }

    setIsProcessingBatch(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of idleCandidates) {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === item.id ? { ...c, status: "generating", errorMessage: undefined } : c
        )
      );

      try {
        const res = await generateCardMutation.mutateAsync({
          articleTitle: item.articleTitle,
          wikiSource: item.wikiSource,
          targetRarity: item.targetRarity !== "AUTO" ? item.targetRarity : undefined,
          customPrompt: item.customPrompt,
        });

        setCandidates((prev) =>
          prev.map((c) =>
            c.id === item.id
              ? {
                  ...c,
                  status: "success",
                  generatedCardId: res.cardId,
                  mintedArtwork: (res as any).artworkUrl || item.imageUrl || null,
                  errorMessage: undefined,
                }
              : c
          )
        );
        successCount++;
      } catch (err: any) {
        const errorMsg = err?.message || "Generation failed";
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === item.id ? { ...c, status: "error", errorMessage: errorMsg } : c
          )
        );
        failCount++;
      }
    }

    setIsProcessingBatch(false);
    if (failCount > 0) {
      notify.warning(
        "Batch Completed with Errors",
        `Finished: ${successCount} minted, ${failCount} failed. Check the error reasons in the queue.`
      );
    } else {
      notify.success(
        "Batch Process Complete",
        `All ${successCount} lore card(s) minted successfully.`
      );
    }
  };

  return (
    <FacetCard
      depth={2}
      className="border-border bg-card/70 text-card-foreground space-y-6 rounded-2xl border p-6 shadow-xl backdrop-blur-xl"
    >
      {/* ─── Header & Sub-Tab Navigation Bar ────────────────────────── */}
      <div className="border-border flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5 backdrop-blur-md">
            <BookOpen className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-foreground text-xl font-bold tracking-tight">
              Lore Card Batch Studio & Requests
            </h2>
            <p className="text-muted-foreground text-xs font-medium">
              AI wiki card generation, category preset crawlers, CSV/JSON bulk import, and request
              queue.
            </p>
          </div>
        </div>

        {/* Sub-Tab Switcher */}
        <FacetContainer
          depth={1}
          enableRefraction={true}
          className="bg-card/60 border-border flex items-center gap-1 rounded-xl border p-1 backdrop-blur-md"
        >
          <button
            onClick={() => setActiveTab("generator")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "generator"
                ? "bg-primary/15 border-primary/40 text-foreground border shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            <BookOpen className="text-primary h-3.5 w-3.5" />
            Batch Studio ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "requests"
                ? "bg-primary/15 border-primary/40 text-foreground border shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            <UserCheck className="text-primary h-3.5 w-3.5" />
            User Queue ({requestStats.data?.pending ?? 0})
          </button>
        </FacetContainer>
      </div>

      {/* ─── TAB 1: BATCH GENERATOR STUDIO ──────────────────────────── */}
      {activeTab === "generator" && (
        <div className="space-y-6">
          {/* Global Parameter Controls */}
          <FacetContainer
            depth={1}
            enableRefraction={true}
            className="border-border bg-card/60 space-y-4 rounded-2xl border p-4 shadow-sm backdrop-blur-md"
          >
            <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
              <Sliders className="h-4 w-4 text-purple-500" />
              <span>Batch Generation Parameters</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {/* Wiki Source */}
              <div>
                <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                  Default Wiki Source
                </label>
                <select
                  value={globalWikiSource}
                  onChange={(e) => setGlobalWikiSource(e.target.value as any)}
                  className="border-border bg-card text-foreground hover:bg-accent focus:ring-primary h-8.5 w-full rounded-xl border px-3 text-xs font-medium transition-all focus:ring-1 focus:outline-none"
                >
                  <option value="ixwiki" className="bg-card text-card-foreground">
                    IxWiki (Primary)
                  </option>
                  <option value="iiwiki" className="bg-card text-card-foreground">
                    IIWiki (Secondary)
                  </option>
                </select>
              </div>

              {/* Target Rarity */}
              <div>
                <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                  Target Rarity Strategy
                </label>
                <select
                  value={globalTargetRarity}
                  onChange={(e) => setGlobalTargetRarity(e.target.value as any)}
                  className="border-border bg-card text-foreground hover:bg-accent focus:ring-primary h-8.5 w-full rounded-xl border px-3 text-xs font-medium transition-all focus:ring-1 focus:outline-none"
                >
                  <option value="AUTO" className="bg-card text-card-foreground">
                    Auto (AI-determined)
                  </option>
                  <option value="COMMON" className="bg-card text-card-foreground">
                    Common
                  </option>
                  <option value="UNCOMMON" className="bg-card text-card-foreground">
                    Uncommon
                  </option>
                  <option value="RARE" className="bg-card text-card-foreground">
                    Rare
                  </option>
                  <option value="ULTRA_RARE" className="bg-card text-card-foreground">
                    Ultra Rare
                  </option>
                  <option value="EPIC" className="bg-card text-card-foreground">
                    Epic
                  </option>
                  <option value="LEGENDARY" className="bg-card text-card-foreground">
                    Legendary
                  </option>
                </select>
              </div>

              {/* Card Season */}
              <div>
                <label className="text-muted-foreground mb-1 block text-[11px] font-medium">
                  Target Card Season
                </label>
                <select
                  value={globalSeason}
                  onChange={(e) => setGlobalSeason(parseInt(e.target.value, 10))}
                  className="border-border bg-card text-foreground hover:bg-accent focus:ring-primary h-8.5 w-full rounded-xl border px-3 text-xs font-medium transition-all focus:ring-1 focus:outline-none"
                >
                  <option value={1} className="bg-card text-card-foreground">
                    Season 1
                  </option>
                  <option value={2} className="bg-card text-card-foreground">
                    Season 2
                  </option>
                  <option value={3} className="bg-card text-card-foreground">
                    Season 3
                  </option>
                </select>
              </div>
            </div>
          </FacetContainer>

          {/* Quick Category Presets & Bulk Import Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-semibold">
                <BookOpen className="h-3 w-3 text-amber-500" /> Category Presets:
              </span>
              {CATEGORY_PRESETS.filter(
                (preset: any) =>
                  !(preset as any).wikiSourceFilter ||
                  (preset as any).wikiSourceFilter === globalWikiSource
              ).map((preset: any) => {
                const Icon = preset.icon;
                const isPresetCrawling = crawlingPresetName === preset.name;
                const stats =
                  categoryStatsData?.stats?.[preset.categoryName] ||
                  categoryStatsData?.stats?.[`Category:${preset.categoryName}`];
                const liveCount = stats
                  ? stats.size || stats.pages + stats.files
                  : preset.categoryName === "IXWB"
                    ? 3371
                    : preset.terms.length;

                return (
                  <button
                    key={preset.name}
                    disabled={Boolean(crawlingPresetName)}
                    onClick={() => handleApplyPreset(preset)}
                    title={`Add all ${liveCount.toLocaleString()} verified ${preset.name} articles & files to batch queue\nCategory: Category:${preset.categoryName}\nSynonyms & Keywords: ${preset.synonyms.slice(0, 10).join(", ")}...`}
                    className="border-border bg-card/60 text-foreground hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-60"
                  >
                    {isPresetCrawling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                    ) : (
                      <Icon className="h-3.5 w-3.5 text-purple-500" />
                    )}
                    <span>{preset.name}</span>
                    <span className="text-muted-foreground bg-muted/80 rounded-md px-1.5 py-0.5 font-mono text-[10px]">
                      {isPresetCrawling ? "Crawling..." : liveCount.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-border bg-card text-foreground hover:bg-accent h-8 rounded-xl text-xs font-semibold transition-all active:scale-95"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV/JSON
              </Button>
              {candidates.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportJSON}
                  className="border-border bg-card text-foreground hover:bg-accent h-8 rounded-xl text-xs font-semibold transition-all active:scale-95"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export JSON
                </Button>
              )}
            </div>
          </div>

          {/* Live Wiki Category Search & Namespace 0 Crawlers */}
          <FacetContainer
            depth={1}
            enableRefraction={true}
            className="border-border bg-card/60 space-y-3 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Category Search Input with Autocomplete Dropdown */}
              <div className="relative flex-1">
                <div className="relative flex items-center">
                  <Search className="text-muted-foreground absolute left-3 h-3.5 w-3.5" />
                  <Input
                    value={categorySearchQuery}
                    onChange={(e) => {
                      setCategorySearchQuery(e.target.value);
                      setIsCategoryDropdownOpen(true);
                    }}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    placeholder={`Search ${globalWikiSource.toUpperCase()} categories (e.g. IXWB, Countries, Wars, Treaties)...`}
                    className="border-border bg-card/80 text-foreground placeholder:text-muted-foreground focus:ring-primary h-8.5 rounded-xl pr-24 pl-8.5 text-xs focus:ring-1"
                  />
                  {categorySearchQuery.trim() && (
                    <Button
                      size="sm"
                      disabled={isCrawlingCategory}
                      onClick={() => handleCrawlCategory(categorySearchQuery)}
                      className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 absolute right-1 h-6.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-all active:scale-95"
                    >
                      {isCrawlingCategory ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <BookOpen className="mr-1 h-3 w-3" />
                      )}
                      Crawl
                    </Button>
                  )}
                </div>

                {/* Dropdown suggestions */}
                {isCategoryDropdownOpen &&
                  categorySearchData?.categories &&
                  categorySearchData.categories.length > 0 && (
                    <div className="border-border bg-popover/95 absolute top-10 right-0 left-0 z-50 max-h-48 space-y-0.5 overflow-y-auto rounded-xl border p-1.5 shadow-xl backdrop-blur-xl">
                      <div className="text-muted-foreground border-border/50 flex items-center justify-between border-b px-2 py-1 pb-1 text-[10px] font-semibold">
                        <span>Matching {globalWikiSource.toUpperCase()} Categories</span>
                        <button
                          onClick={() => setIsCategoryDropdownOpen(false)}
                          className="text-muted-foreground hover:text-foreground text-[10px] hover:underline"
                        >
                          Close
                        </button>
                      </div>
                      {categorySearchData.categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleCrawlCategory(cat)}
                          className="text-foreground hover:bg-accent/80 group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-all"
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <BookOpen className="h-3 w-3 text-purple-400" />
                            {cat}
                          </span>
                          <span className="text-muted-foreground group-hover:text-primary font-mono text-[10px] transition-colors">
                            Crawl Category →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {/* Crawl All Namespace 0 (Main Pages) Action Button */}
              <Button
                size="sm"
                variant="outline"
                disabled={isCrawlingAllPages}
                onClick={handleCrawlAllMainPages}
                title={`Fetch all articles in the main namespace (namespace 0) on ${globalWikiSource.toUpperCase()}`}
                className="h-8.5 shrink-0 rounded-xl border-purple-500/40 bg-purple-500/10 text-xs font-semibold text-purple-400 transition-all hover:bg-purple-500/20 active:scale-95"
              >
                {isCrawlingAllPages ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="mr-1.5 h-3.5 w-3.5 text-purple-400" />
                )}
                Parse All {globalWikiSource.toUpperCase()} Main Pages (Namespace 0)
              </Button>
            </div>
          </FacetContainer>

          {/* Manual Input Box */}
          <FacetContainer
            depth={1}
            enableRefraction={true}
            className="border-border bg-card/60 space-y-3 rounded-2xl border p-4 backdrop-blur-md"
          >
            <div className="flex items-center justify-between">
              <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                <FileText className="text-primary h-4 w-4" />
                Add Articles & Categories to Queue (Comma or Newline Separated)
              </label>
              <Button
                size="sm"
                onClick={handleAddArticlesFromText}
                disabled={!articleInput.trim()}
                className="border-primary/30 bg-primary/20 text-primary hover:bg-primary/30 h-7 rounded-lg border text-xs font-semibold transition-all active:scale-95"
              >
                Add to Queue
              </Button>
            </div>
            <textarea
              value={articleInput}
              onChange={(e) => setArticleInput(e.target.value)}
              placeholder="e.g. Caphiria, Daxia, Category:IXWB, Category:Wars, Category:Treaties, Urcea..."
              className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary h-20 w-full rounded-xl border p-3 text-xs transition-all outline-none focus:ring-1"
            />
            <p className="text-muted-foreground text-[11px]">
              💡 Supports individual article titles, comma-separated lists, and{" "}
              <code className="rounded bg-purple-500/10 px-1 py-0.5 font-mono text-purple-400">
                Category:&lt;Name&gt;
              </code>{" "}
              to automatically crawl and load all member pages.
            </p>
          </FacetContainer>

          {/* Batch Candidate Queue Table */}
          {candidates.length > 0 && (
            <FacetContainer
              depth={1}
              enableRefraction={true}
              className="border-border bg-card/40 space-y-3 overflow-hidden rounded-2xl border p-4 shadow-inner backdrop-blur-md"
            >
              <div className="border-border flex flex-col gap-2.5 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-500" />
                  <span className="text-foreground text-xs font-bold">
                    Batch Candidates Queue ({candidates.length})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Deduplicate Queue button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeduplicateQueue}
                    disabled={isProcessingBatch || candidates.length <= 1}
                    className="border-border text-foreground hover:bg-accent h-7.5 rounded-lg border px-2.5 text-xs font-semibold shadow-xs transition-all active:scale-95"
                    title="Remove duplicate articles currently in this queue"
                  >
                    <Layers className="mr-1 h-3.5 w-3.5 text-purple-500" /> Deduplicate Queue
                  </Button>

                  {/* Purge Database Duplicates Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPurgeDialogOpen(true)}
                    disabled={isProcessingBatch}
                    className="h-7.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 text-xs font-semibold text-rose-600 shadow-xs transition-all hover:bg-rose-500/20 active:scale-95 dark:text-rose-400"
                    title="Scan and purge duplicate cards from the database"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Purge DB Duplicates (
                    {duplicateStats?.totalDuplicates ?? 0})
                  </Button>

                  {/* Backfill Authors Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsBackfillDialogOpen(true)}
                    disabled={isProcessingBatch}
                    className="h-7.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-600 shadow-xs transition-all hover:bg-amber-500/20 active:scale-95 dark:text-amber-400"
                    title="Backfill page creator and contributor attribution for existing lore cards"
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5 text-amber-500" /> Backfill Wiki Authors
                  </Button>

                  {/* Re-Catalog Categories Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsReclassifyDialogOpen(true)}
                    disabled={isProcessingBatch}
                    className="h-7.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 text-xs font-semibold text-purple-600 shadow-xs transition-all hover:bg-purple-500/20 active:scale-95 dark:text-purple-300"
                    title="Re-scan and categorize lore cards with multi-signal infobox & category tree classifier"
                  >
                    <Layers className="mr-1 h-3.5 w-3.5 text-purple-500" /> Re-Catalog Categories
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCandidates([])}
                    disabled={isProcessingBatch}
                    className="h-7.5 rounded-lg px-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear All
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleProcessBatch}
                    disabled={isProcessingBatch || candidates.every((c) => c.status !== "idle")}
                    className="h-8 rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-xs font-semibold text-emerald-600 shadow-xs transition-all hover:bg-emerald-500/30 active:scale-95 dark:text-emerald-300"
                  >
                    {isProcessingBatch ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Generating Batch...
                      </>
                    ) : (
                      <>
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Mint Batch Lore Cards (
                        {candidates.filter((c) => c.status === "idle").length})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Queue Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter("ALL")}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    candidateStatusFilter === "ALL"
                      ? "bg-primary/20 text-primary border-primary/30 border"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  All ({candidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter("idle")}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    candidateStatusFilter === "idle"
                      ? "bg-muted text-foreground border-border border"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  Queued ({idleCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter("generating")}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    candidateStatusFilter === "generating"
                      ? "border border-blue-500/30 bg-blue-500/20 text-blue-500"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  Generating ({generatingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateStatusFilter("success")}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    candidateStatusFilter === "success"
                      ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-500"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  Minted ({successCount})
                </button>
                {errorCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setCandidateStatusFilter("error")}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      candidateStatusFilter === "error"
                        ? "border border-rose-500/40 bg-rose-500/25 text-rose-500 shadow-xs"
                        : "text-rose-500/80 hover:bg-rose-500/10 hover:text-rose-500"
                    }`}
                  >
                    Failed ({errorCount})
                  </button>
                )}
              </div>

              {/* Failed Imports Diagnostic Alert Banner */}
              {errorCount > 0 && (
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs backdrop-blur-md sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <div>
                      <div className="font-bold text-rose-600 dark:text-rose-400">
                        {errorCount} candidate{errorCount > 1 ? "s" : ""} failed during generation
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-[11px]">
                        Common issues: Article missing on wiki, stub/short article, duplicate card,
                        or API timeout.
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyErrorReport}
                      className="h-7 border-rose-500/30 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy Error Log
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearFailed}
                      className="border-border text-muted-foreground hover:bg-accent hover:text-foreground h-7 text-[11px] font-semibold"
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Clear Failed
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleRetryAllFailed}
                      disabled={isProcessingBatch}
                      className="h-7 border border-rose-500/40 bg-rose-500/20 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/30 dark:text-rose-300"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Retry All Failed ({errorCount})
                    </Button>
                  </div>
                </div>
              )}

              <div className="max-h-[440px] overflow-x-auto overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-border bg-card/95 text-muted-foreground sticky top-0 z-10 border-b text-[10px] font-semibold tracking-wider uppercase backdrop-blur-xl">
                    <tr>
                      <th className="w-14 px-3 py-2.5 text-center">Artwork</th>
                      <th className="px-4 py-2.5">Article Title</th>
                      <th className="px-4 py-2.5">Source</th>
                      <th className="px-4 py-2.5">Target Rarity</th>
                      <th className="px-4 py-2.5">Season</th>
                      <th className="px-4 py-2.5">Status & Error Diagnostics</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/60 divide-y">
                    {filteredCandidates.map((c) => {
                      const artworkToShow = c.mintedArtwork || c.imageUrl;
                      return (
                        <tr key={c.id} className="hover:bg-accent/40 transition-colors">
                          {/* Artwork Thumbnail / Clickable Image */}
                          <td className="px-3 py-2 text-center">
                            {artworkToShow ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    title: c.articleTitle,
                                    imageUrl: artworkToShow,
                                    extract: c.extract,
                                    wikiSource: c.wikiSource,
                                    category: c.category,
                                    rarity: c.targetRarity,
                                    season: c.season,
                                  })
                                }
                                className="group border-border/80 relative mx-auto h-10 w-10 cursor-pointer overflow-hidden rounded-lg border bg-black/40 shadow-xs transition-transform hover:scale-105 active:scale-95"
                                title="Click to inspect full image"
                              >
                                <img
                                  src={artworkToShow}
                                  alt={c.articleTitle}
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                  <Eye className="h-3.5 w-3.5 text-white" />
                                </div>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    title: c.articleTitle,
                                    imageUrl: "",
                                    extract: c.extract,
                                    wikiSource: c.wikiSource,
                                    category: c.category,
                                    rarity: c.targetRarity,
                                    season: c.season,
                                  })
                                }
                                className="border-border/60 bg-muted/40 text-muted-foreground/60 hover:text-foreground mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border transition-colors"
                                title="No primary image parsed. Click to inspect details"
                              >
                                <ImageIcon className="h-4 w-4" />
                              </button>
                            )}
                          </td>

                          <td className="text-foreground px-4 py-2.5 font-semibold">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span>{c.articleTitle}</span>
                                {c.category && (
                                  <span className="bg-primary/10 border-primary/20 py-0.2 text-primary rounded-full border px-1.5 text-[8px] font-bold uppercase">
                                    {c.category}
                                  </span>
                                )}
                              </div>
                              {c.author &&
                                c.author !== "Unknown" &&
                                !c.author.toLowerCase().includes("community") && (
                                  <span className="line-clamp-1 text-[10px] font-medium text-amber-500/90">
                                    ✍️ {c.author}
                                  </span>
                                )}
                              {c.extract &&
                                (!c.author ||
                                  c.author === "Unknown" ||
                                  c.author.toLowerCase().includes("community")) && (
                                  <span className="text-muted-foreground line-clamp-1 text-[10px] font-normal">
                                    {c.extract}
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {c.wikiSource === "iiwiki" ? (
                              <IIWikiBadge size="xs" />
                            ) : (
                              <span className="bg-muted border-border text-foreground rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase">
                                {c.wikiSource}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-300">
                              {c.targetRarity}
                            </span>
                          </td>
                          <td className="text-muted-foreground px-4 py-2.5">S{c.season}</td>
                          <td className="px-4 py-2.5">
                            {c.status === "generating" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500">
                                <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                              </span>
                            )}
                            {c.status === "success" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                                <CheckCircle2 className="h-3 w-3" /> Minted (
                                {c.generatedCardId?.slice(0, 8)})
                              </span>
                            )}
                            {c.status === "error" && (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedErrorCandidate(c)}
                                  className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-600 transition-all hover:bg-rose-500/25 dark:text-rose-400"
                                  title="Click to view full failure diagnostic"
                                >
                                  <XCircle className="h-3 w-3 text-rose-500" />
                                  Failed
                                </button>
                                {c.errorMessage && (
                                  <span
                                    onClick={() => setSelectedErrorCandidate(c)}
                                    className="line-clamp-1 max-w-[240px] cursor-pointer text-[10px] font-medium text-rose-500/90 hover:underline"
                                    title={c.errorMessage}
                                  >
                                    {c.errorMessage}
                                  </span>
                                )}
                              </div>
                            )}
                            {c.status === "idle" && (
                              <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                                <Clock className="h-3 w-3" /> Queued
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {c.status === "error" && (
                                <button
                                  type="button"
                                  onClick={() => handleRetryCandidate(c.id)}
                                  disabled={isProcessingBatch}
                                  className="text-muted-foreground cursor-pointer rounded p-1 transition-all hover:bg-blue-500/10 hover:text-blue-400"
                                  title="Retry Import"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {artworkToShow && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImage({
                                      title: c.articleTitle,
                                      imageUrl: artworkToShow,
                                      extract: c.extract,
                                      wikiSource: c.wikiSource,
                                      category: c.category,
                                      rarity: c.targetRarity,
                                      season: c.season,
                                    })
                                  }
                                  className="text-muted-foreground cursor-pointer rounded p-1 transition-all hover:bg-purple-500/10 hover:text-purple-400"
                                  title="Inspect Artwork"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setCandidates((prev) => prev.filter((item) => item.id !== c.id))
                                }
                                className="text-muted-foreground cursor-pointer rounded p-1 transition-all hover:bg-rose-500/10 hover:text-rose-500"
                                title="Remove Candidate"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FacetContainer>
          )}
        </div>
      )}

      {/* ─── TAB 2: USER REQUEST QUEUE ──────────────────────────────── */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {/* Stats Bar */}
          {requestStats.data && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FacetCard
                depth={1}
                interactive="hover"
                className="border-border bg-card/70 rounded-xl border p-3 backdrop-blur-md"
              >
                <div className="text-muted-foreground text-[11px]">Total Requests</div>
                <div className="text-foreground mt-0.5 text-lg font-bold">
                  {requestStats.data.total}
                </div>
              </FacetCard>
              <FacetCard
                depth={1}
                interactive="hover"
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 backdrop-blur-md"
              >
                <div className="text-muted-foreground text-[11px]">Pending Approval</div>
                <div className="mt-0.5 text-lg font-bold text-amber-500 dark:text-amber-300">
                  {requestStats.data.pending}
                </div>
              </FacetCard>
              <FacetCard
                depth={1}
                interactive="hover"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 backdrop-blur-md"
              >
                <div className="text-muted-foreground text-[11px]">Generated Cards</div>
                <div className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {requestStats.data.generated}
                </div>
              </FacetCard>
              <FacetCard
                depth={1}
                interactive="hover"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 backdrop-blur-md"
              >
                <div className="text-muted-foreground text-[11px]">Rejected</div>
                <div className="mt-0.5 text-lg font-bold text-rose-600 dark:text-rose-400">
                  {requestStats.data.rejected}
                </div>
              </FacetCard>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">Filter Queue:</span>
              <select
                value={requestStatusFilter}
                onChange={(e) => setRequestStatusFilter(e.target.value)}
                className="border-border bg-card text-foreground hover:bg-accent h-8.5 rounded-xl border px-3 text-xs font-semibold transition-all focus:outline-none"
              >
                <option value="ALL" className="bg-card text-card-foreground">
                  All Requests
                </option>
                <option value="PENDING" className="bg-card text-card-foreground">
                  Pending Only
                </option>
                <option value="APPROVED" className="bg-card text-card-foreground">
                  Approved Only
                </option>
                <option value="GENERATED" className="bg-card text-card-foreground">
                  Generated Only
                </option>
                <option value="REJECTED" className="bg-card text-card-foreground">
                  Rejected Only
                </option>
              </select>
            </div>
          </div>

          {/* Request Queue Table */}
          {requestQueue.isLoading ? (
            <div className="border-border bg-card/40 flex h-48 items-center justify-center rounded-xl border backdrop-blur-md">
              <Loader2 className="text-primary h-6 w-6 animate-spin" />
            </div>
          ) : !requestQueue.data || requestQueue.data.requests.length === 0 ? (
            <div className="border-border bg-card/30 flex h-40 flex-col items-center justify-center rounded-xl border border-dashed backdrop-blur-md">
              <BookOpen className="text-muted-foreground/40 mb-1.5 h-8 w-8" />
              <p className="text-foreground text-sm font-semibold">No requests found in queue</p>
            </div>
          ) : (
            <FacetContainer
              depth={1}
              enableRefraction={true}
              className="border-border bg-card/40 overflow-hidden rounded-2xl border shadow-inner backdrop-blur-md"
            >
              <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-border bg-card/95 text-muted-foreground sticky top-0 z-10 border-b text-[10px] font-semibold tracking-wider uppercase backdrop-blur-xl">
                    <tr>
                      <th className="px-4 py-3">Article Title</th>
                      <th className="px-4 py-3">Wiki Source</th>
                      <th className="px-4 py-3">Requester (Nation / User)</th>
                      <th className="px-4 py-3">Requested Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/60 divide-y">
                    {requestQueue.data.requests.map((request: any) => {
                      const isPending = request.status === "PENDING";
                      const isApproved = request.status === "APPROVED";
                      const isGenerated = request.status === "GENERATED";
                      const isRejected = request.status === "REJECTED";

                      return (
                        <tr key={request.id} className="hover:bg-accent/40 transition-colors">
                          <td className="text-foreground px-4 py-3 font-semibold">
                            {request.articleTitle}
                          </td>
                          <td className="px-4 py-3">
                            {request.wikiSource === "iiwiki" ? (
                              <IIWikiBadge size="xs" />
                            ) : (
                              <span className="bg-muted border-border text-foreground rounded-full border px-2 py-0.5 text-[9px] font-bold">
                                {request.wikiSource}
                              </span>
                            )}
                          </td>
                          <td className="text-foreground px-4 py-3 font-medium">
                            <span className="bg-primary/10 border-primary/20 text-primary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
                              <UserCheck className="h-3 w-3" />
                              {request.requesterName || request.userId}
                            </span>
                          </td>
                          <td className="text-muted-foreground px-4 py-3">
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {isPending && (
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-500 dark:text-amber-300">
                                Pending
                              </span>
                            )}
                            {isApproved && (
                              <span className="rounded-full border border-blue-500/30 bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-300">
                                Approved
                              </span>
                            )}
                            {isGenerated && (
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                                Generated
                              </span>
                            )}
                            {isRejected && (
                              <span className="rounded-full border border-rose-500/30 bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              {isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      approveMutation.mutate({ requestId: request.id })
                                    }
                                    disabled={approveMutation.isPending}
                                    className="h-7 rounded-lg border border-emerald-500/30 bg-emerald-500/20 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/30 dark:text-emerald-300"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRejectionRequestId(request.id)}
                                    className="h-7 rounded-lg border border-rose-500/20 bg-rose-500/10 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-300"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              {(isPending || isApproved) && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    generateRequestedMutation.mutate({ requestId: request.id })
                                  }
                                  disabled={generateRequestedMutation.isPending}
                                  className="h-7 rounded-lg border border-purple-500/30 bg-purple-500/20 text-[11px] font-semibold text-purple-600 hover:bg-purple-500/30 dark:text-purple-300"
                                >
                                  Mint Card
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </FacetContainer>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      <Dialog
        open={rejectionRequestId !== null}
        onOpenChange={(open) => !open && setRejectionRequestId(null)}
      >
        <DialogContent className="border-border bg-card text-card-foreground border shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              Reject Lore Card Request & Refund 50 IxC?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Provide an optional reason for the user. The 50 IxC request fee will be automatically
              refunded to their vault.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection (e.g. Article non-existent or duplicate)"
            className="border-border bg-card text-foreground placeholder:text-muted-foreground h-9 rounded-xl text-xs"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionRequestId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (rejectionRequestId) {
                  rejectMutation.mutate({
                    requestId: rejectionRequestId,
                    reason: rejectionReason || undefined,
                  });
                }
              }}
              disabled={rejectMutation.isPending}
              className="bg-rose-500 font-semibold text-white hover:bg-rose-600"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Artwork & Image Inspector Lightbox Modal ──────────── */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="border-border/80 bg-card/95 text-card-foreground max-w-2xl overflow-hidden rounded-2xl border p-0 shadow-2xl backdrop-blur-2xl">
          {previewImage && (
            <div>
              {/* Header */}
              <div className="border-border/60 flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-foreground text-base font-bold">
                      {previewImage.title}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                      Parsed Wiki Artwork & Media Inspector
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {previewImage.wikiSource && (
                    <span className="bg-muted border-border text-foreground rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                      {previewImage.wikiSource}
                    </span>
                  )}
                  {previewImage.rarity && (
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-bold text-purple-400">
                      {previewImage.rarity}
                    </span>
                  )}
                </div>
              </div>

              {/* Main Image Stage */}
              <div className="border-border/60 relative flex max-h-[480px] min-h-[300px] w-full items-center justify-center border-b bg-black/60 p-4">
                {previewImage.imageUrl ? (
                  <img
                    src={previewImage.imageUrl}
                    alt={previewImage.title}
                    className="max-h-[420px] w-auto max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
                    <ImageIcon className="mb-2 h-12 w-12 stroke-[1.5] opacity-50" />
                    <p className="text-xs">No primary artwork detected for this article</p>
                  </div>
                )}
              </div>

              {/* Details & Excerpt */}
              <div className="space-y-3 p-6">
                {previewImage.author &&
                  previewImage.author !== "Unknown" &&
                  !previewImage.author.toLowerCase().includes("community") && (
                    <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                        Wiki Author:
                      </span>
                      <span className="font-semibold">{previewImage.author}</span>
                    </div>
                  )}

                {previewImage.extract && (
                  <div className="bg-card/60 border-border/60 text-muted-foreground max-h-24 overflow-y-auto rounded-xl border p-3 text-xs leading-relaxed">
                    <p className="text-foreground mb-1 text-[11px] font-semibold">
                      Article Summary:
                    </p>
                    {previewImage.extract}
                  </div>
                )}

                {previewImage.imageUrl && (
                  <div className="bg-muted/40 border-border/40 flex items-center justify-between rounded-xl border px-3 py-2 font-mono text-[11px]">
                    <span className="text-muted-foreground max-w-[400px] truncate">
                      {previewImage.imageUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(previewImage.imageUrl);
                        notify.success("Copied", "Image URL copied to clipboard.");
                      }}
                      className="text-primary ml-2 flex shrink-0 cursor-pointer items-center gap-1 font-sans hover:underline"
                    >
                      <Copy className="h-3 w-3" /> Copy URL
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-border/60 bg-card/40 flex items-center justify-between border-t px-6 py-3.5">
                {previewImage.wikiSource ? (
                  <a
                    href={
                      previewImage.wikiSource === "iiwiki"
                        ? `https://iiwiki.com/wiki/${encodeURIComponent(previewImage.title.replace(/ /g, "_"))}`
                        : `https://ixwiki.com/wiki/${encodeURIComponent(previewImage.title.replace(/ /g, "_"))}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View Wiki Article
                  </a>
                ) : (
                  <div />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewImage(null)}
                  className="border-border rounded-xl border text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Purge Duplicates Modal ──────────────────────────────── */}
      <Dialog open={isPurgeDialogOpen} onOpenChange={setIsPurgeDialogOpen}>
        <DialogContent className="border-border/80 bg-card/95 text-card-foreground max-w-xl rounded-2xl border shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5">
                <Trash2 className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <DialogTitle className="text-foreground text-base font-bold">
                  Purge Duplicate Cards ({duplicateStats?.totalDuplicates ?? 0} Redundant)
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Safely consolidate duplicate cards and clean up redundant database copies.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-700 dark:text-amber-300">
              <p className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                How Duplicate Purging Works:
              </p>
              <p className="text-[11px] leading-relaxed opacity-90">
                For each article with duplicate cards, the system selects the highest-level / most
                referenced card as the Primary Keeper. All user ownerships, auctions, and value
                history are re-linked to the keeper card before deleting redundant copies.
              </p>
            </div>

            {duplicateStats?.loreGroups && duplicateStats.loreGroups.length > 0 ? (
              <div className="space-y-2">
                <span className="text-foreground block font-semibold">
                  Duplicate Groups ({duplicateStats.loreGroups.length} unique articles):
                </span>
                <div className="border-border bg-card/60 divide-border/60 max-h-52 divide-y overflow-y-auto rounded-xl border">
                  {duplicateStats.loreGroups.map(
                    (
                      g: {
                        title: string;
                        wikiSource: string;
                        count: number;
                        redundantCount: number;
                      },
                      idx: number
                    ) => (
                      <div key={idx} className="flex items-center justify-between p-2.5">
                        <div className="min-w-0">
                          <p className="text-foreground truncate font-semibold">{g.title}</p>
                          <span className="text-muted-foreground font-mono text-[10px] uppercase">
                            {g.wikiSource}
                          </span>
                        </div>
                        <span className="shrink-0 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          {g.count} copies (+{g.redundantCount} redundant)
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground py-4 text-center">
                <CheckCircle2 className="mx-auto mb-1.5 h-8 w-8 text-emerald-500 opacity-80" />
                <p className="text-foreground font-semibold">No Duplicate Lore Cards Found</p>
                <p className="text-[11px]">
                  Your database is clean with no redundant lore card records.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPurgeDialogOpen(false)}
              className="border-border rounded-xl border text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                purgeDuplicatesMutation.isPending || (duplicateStats?.totalDuplicates ?? 0) === 0
              }
              onClick={() => purgeDuplicatesMutation.mutate({ mode: "wiki_lore" })}
              className="rounded-xl bg-rose-500 text-xs font-semibold text-white shadow-xs transition-all hover:bg-rose-600 active:scale-95"
            >
              {purgeDuplicatesMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Purging...
                </>
              ) : (
                <>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Purge{" "}
                  {duplicateStats?.totalDuplicates ?? 0} Duplicates
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Backfill Authors Modal ──────────────────────────────── */}
      <Dialog open={isBackfillDialogOpen} onOpenChange={setIsBackfillDialogOpen}>
        <DialogContent className="border-border/80 bg-card/95 text-card-foreground max-w-md rounded-2xl border shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-foreground text-base font-bold">
                  Backfill Wiki Authors
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Query MediaWiki API to parse and store creator & top contributor attribution on
                  lore cards.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Wiki Source Selector */}
            <div className="border-border/60 bg-muted/30 space-y-2 rounded-xl border p-3">
              <label className="text-foreground block text-xs font-semibold">Wiki Source:</label>
              <div className="flex items-center gap-2">
                {[
                  { id: "all", label: "All Sources" },
                  { id: "ixwiki", label: "IxWiki" },
                  { id: "iiwiki", label: "IIWiki" },
                ].map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setBackfillSource(src.id as "all" | "ixwiki" | "iiwiki")}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-all ${
                      backfillSource === src.id
                        ? "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Limit Selector */}
            <div className="border-border/60 bg-muted/30 space-y-2 rounded-xl border p-3">
              <label className="text-foreground block text-xs font-semibold">Batch Limit:</label>
              <div className="flex items-center gap-2">
                {[50, 100, 250, 500].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setBackfillLimit(num)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-all ${
                      backfillLimit === num
                        ? "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {num} Cards
                  </button>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              This will find lore cards from{" "}
              <strong className="text-foreground">
                {backfillSource === "all" ? "all wikis" : backfillSource.toUpperCase()}
              </strong>{" "}
              without saved{" "}
              <code className="rounded bg-amber-500/10 px-1 py-0.5 font-mono text-amber-500">
                authorInfo
              </code>
              , fetch their revision history to locate human page creators and top editors, and
              persist the attribution to the database.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBackfillDialogOpen(false)}
              className="border-border rounded-xl border text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={backfillAuthorsMutation.isPending}
              onClick={() =>
                backfillAuthorsMutation.mutate({ limit: backfillLimit, wikiSource: backfillSource })
              }
              className="rounded-xl bg-amber-500 text-xs font-bold text-black shadow-xs transition-all hover:bg-amber-600 active:scale-95"
            >
              {backfillAuthorsMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Backfilling...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Start Backfill ({backfillLimit})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Re-Catalog Categories Modal ──────────────────────────── */}
      <Dialog open={isReclassifyDialogOpen} onOpenChange={setIsReclassifyDialogOpen}>
        <DialogContent className="bg-card/95 border-border/80 max-w-md space-y-4 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5">
                <Layers className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <DialogTitle className="text-foreground text-base font-bold">
                  Re-Catalog Lore Categories
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Re-evaluate existing lore cards using Infobox template and category tree scoring.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Wiki Source Selector */}
            <div className="border-border/60 bg-muted/30 space-y-2 rounded-xl border p-3">
              <label className="text-foreground block text-xs font-semibold">Wiki Source:</label>
              <div className="flex items-center gap-2">
                {[
                  { id: "all", label: "All Sources" },
                  { id: "ixwiki", label: "IxWiki" },
                  { id: "iiwiki", label: "IIWiki" },
                ].map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setReclassifySource(src.id as "all" | "ixwiki" | "iiwiki")}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-all ${
                      reclassifySource === src.id
                        ? "border-purple-500 bg-purple-500/20 text-purple-600 dark:text-purple-300"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Limit Selector */}
            <div className="border-border/60 bg-muted/30 space-y-2 rounded-xl border p-3">
              <label className="text-foreground block text-xs font-semibold">Batch Limit:</label>
              <div className="flex items-center gap-2">
                {[50, 100, 250, 500].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setReclassifyLimit(num)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-all ${
                      reclassifyLimit === num
                        ? "border-purple-500 bg-purple-500/20 text-purple-600 dark:text-purple-300"
                        : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {num} Cards
                  </button>
                ))}
              </div>
            </div>

            {/* Overwrite Toggle */}
            <div className="border-border/60 bg-muted/30 flex items-center justify-between rounded-xl border p-3">
              <div>
                <span className="text-foreground block text-xs font-semibold">Force Overwrite</span>
                <span className="text-muted-foreground text-[10px]">
                  Re-classify all cards, not just unclassified/defaults
                </span>
              </div>
              <input
                type="checkbox"
                checked={reclassifyForce}
                onChange={(e) => setReclassifyForce(e.target.checked)}
                className="border-border h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
              />
            </div>

            <p className="text-muted-foreground text-[11px] leading-relaxed">
              This will analyze lore cards from{" "}
              <strong className="text-foreground">
                {reclassifySource === "all" ? "all wikis" : reclassifySource.toUpperCase()}
              </strong>{" "}
              against the 12 canonical LoreCategory enums, matching infobox types (e.g.
              officeholders, treaties, battles, settlements) and persisting accurate category seals.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReclassifyDialogOpen(false)}
              className="border-border rounded-xl border text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={reclassifyCategoriesMutation.isPending}
              onClick={() =>
                reclassifyCategoriesMutation.mutate({
                  limit: reclassifyLimit,
                  wikiSource: reclassifySource,
                  forceOverwrite: reclassifyForce,
                })
              }
              className="rounded-xl bg-purple-600 text-xs font-bold text-white shadow-xs transition-all hover:bg-purple-700 active:scale-95"
            >
              {reclassifyCategoriesMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Classifying...
                </>
              ) : (
                <>
                  <Layers className="mr-1.5 h-3.5 w-3.5" /> Start Re-Catalog ({reclassifyLimit})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detailed Error Diagnostic Dialog ─────────────────────── */}
      <Dialog
        open={!!selectedErrorCandidate}
        onOpenChange={(isOpen) => !isOpen && setSelectedErrorCandidate(null)}
      >
        <DialogContent className="bg-card/95 border-border/80 max-w-md space-y-4 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <DialogTitle className="text-foreground text-base font-bold tracking-tight">
                  Import Failure Diagnostics
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  Troubleshooting details for why this lore card failed to generate.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedErrorCandidate && (
            <div className="space-y-3 py-1 text-xs">
              <div className="border-border/60 bg-muted/40 space-y-2 rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Article Title:</span>
                  <span className="text-foreground font-bold">
                    {selectedErrorCandidate.articleTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Wiki Source:</span>
                  <span className="text-foreground font-bold uppercase">
                    {selectedErrorCandidate.wikiSource}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Target Rarity:</span>
                  <span className="font-bold text-purple-400">
                    {selectedErrorCandidate.targetRarity}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <XCircle className="h-4 w-4 text-rose-500" /> Error Reason
                </div>
                <div className="font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-rose-700 dark:text-rose-300">
                  {selectedErrorCandidate.errorMessage ||
                    "Unknown error occurred during generation."}
                </div>
              </div>

              <div className="border-border/40 bg-card/60 text-muted-foreground space-y-1 rounded-xl border p-3 text-[11px]">
                <div className="text-foreground flex items-center gap-1 font-semibold">
                  <Info className="text-primary h-3.5 w-3.5" /> Troubleshooting Tips:
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>
                    Verify article spelling, casing, and underscores on{" "}
                    {selectedErrorCandidate.wikiSource.toUpperCase()}.
                  </li>
                  <li>
                    Ensure the article has sufficient prose content (not an empty stub or redirect).
                  </li>
                  <li>Check if a card for this article title already exists in the database.</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedErrorCandidate(null)}
              className="border-border rounded-xl border text-xs"
            >
              Close
            </Button>
            {selectedErrorCandidate && (
              <Button
                size="sm"
                onClick={() => {
                  const id = selectedErrorCandidate.id;
                  setSelectedErrorCandidate(null);
                  void handleRetryCandidate(id);
                }}
                disabled={isProcessingBatch}
                className="bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry Import Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FacetCard>
  );
}
