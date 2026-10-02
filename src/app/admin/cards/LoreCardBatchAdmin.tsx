"use client";
// src/app/admin/cards/LoreCardBatchAdmin.tsx
// Unified Theme-Compliant Apple Design Lore Card Batch Generator & User Request Queue

import { useState, useRef, useMemo } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  Download,
  Search,
  Xmark as X,
  WarningCircle as AlertCircle,
  WarningTriangle as AlertTriangle,
  OpenBook as BookOpen,
  Globe,
  SystemRestart as Loader2,
  CheckCircle as CheckCircle2,
  XmarkCircle as XCircle,
  Clock,
  Upload,
  UserBadgeCheck as UserCheck,
  ControlSlider as Sliders,
  Component as Layers,
  Page as FileText,
  Trash as Trash2,
  Play,
  Sparks as Sparkles,
  MediaImage as ImageIcon,
  Eye,
  Copy,
  OpenNewWindow as ExternalLink,
  Undo as RotateCcw,
  InfoCircle as Info,
} from "iconoir-react";
import type { CardRarity } from "@prisma/client";
import type { CardAuthorInfo } from "~/types/cards-display";
import { IIWikiBadge } from "~/components/cards/display/IIWikiLogo";

import { CATEGORY_PRESETS } from "./lore-batch/category-presets";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";

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
    // oxlint-disable-next-line eslint/no-shadow -- shadowed 'successCount' is intentional in this scope
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
    <Card className="space-y-6 p-6">
      {/* ─── Header & Sub-Tab Navigation Bar ────────────────────────── */}
      <div className="border-separator flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-row border-purple/30 bg-purple/10 border p-3">
            <BookOpen className="text-purple h-5 w-5" />
          </div>
          <div>
            <h2 className="text-label text-title-2">Lore Card Batch Studio & Requests</h2>
            <p className="text-label-secondary text-caption">
              AI wiki card generation, category preset crawlers, CSV/JSON bulk import, and request
              queue.
            </p>
          </div>
        </div>

        {/* Sub-tab switcher */}
        <SegmentedControl
          asTabs
          aria-label="Lore batch views"
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            {
              value: "generator",
              label: `Batch Studio (${candidates.length})`,
              icon: <BookOpen />,
            },
            {
              value: "requests",
              label: `User Queue (${requestStats.data?.pending ?? 0})`,
              icon: <UserCheck />,
            },
          ]}
        />
      </div>

      {/* ─── TAB 1: BATCH GENERATOR STUDIO ──────────────────────────── */}
      {activeTab === "generator" && (
        <div className="space-y-6">
          {/* Global Parameter Controls */}
          <Card className="space-y-4 p-4">
            <div className="text-label text-caption flex items-center gap-2">
              <Sliders className="text-purple h-4 w-4" />
              <span>Batch Generation Parameters</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {/* Wiki Source */}
              <div>
                <label className="text-label-secondary text-caption mb-1 block">
                  Default Wiki Source
                </label>
                <Select
                  value={globalWikiSource}
                  onValueChange={(v) => setGlobalWikiSource(v as any)}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ixwiki">IxWiki (Primary)</SelectItem>
                    <SelectItem value="iiwiki">IIWiki (Secondary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Rarity */}
              <div>
                <label className="text-label-secondary text-caption mb-1 block">
                  Target Rarity Strategy
                </label>
                <Select
                  value={globalTargetRarity}
                  onValueChange={(v) => setGlobalTargetRarity(v as any)}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto (AI-determined)</SelectItem>
                    <SelectItem value="COMMON">Common</SelectItem>
                    <SelectItem value="UNCOMMON">Uncommon</SelectItem>
                    <SelectItem value="RARE">Rare</SelectItem>
                    <SelectItem value="ULTRA_RARE">Ultra Rare</SelectItem>
                    <SelectItem value="EPIC">Epic</SelectItem>
                    <SelectItem value="LEGENDARY">Legendary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Card Season */}
              <div>
                <label className="text-label-secondary text-caption mb-1 block">
                  Target Card Season
                </label>
                <Select
                  value={String(globalSeason)}
                  onValueChange={(v) => setGlobalSeason(parseInt(v, 10))}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={String(1)}>Season 1</SelectItem>
                    <SelectItem value={String(2)}>Season 2</SelectItem>
                    <SelectItem value={String(3)}>Season 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Quick Category Presets & Bulk Import Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-secondary text-caption flex items-center gap-1">
                <BookOpen className="text-yellow h-3 w-3" /> Category Presets:
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
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    disabled={Boolean(crawlingPresetName)}
                    onClick={() => handleApplyPreset(preset)}
                    title={`Add all ${liveCount.toLocaleString()} verified ${preset.name} articles & files to batch queue\nCategory: Category:${preset.categoryName}\nSynonyms & Keywords: ${preset.synonyms.slice(0, 10).join(", ")}...`}
                  >
                    {isPresetCrawling ? (
                      <Loader2 className="text-purple h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="text-purple h-3.5 w-3.5" />
                    )}
                    <span>{preset.name}</span>
                    <Badge variant="neutral" className="tabular-nums">
                      {isPresetCrawling ? "Crawling..." : liveCount.toLocaleString()}
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
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-3.5 w-3.5" /> Import CSV/JSON
              </Button>
              {candidates.length > 0 && (
                <Button size="sm" variant="outline" onClick={handleExportJSON}>
                  <Download className="mr-2 h-3.5 w-3.5" /> Export JSON
                </Button>
              )}
            </div>
          </div>

          {/* Live Wiki Category Search & Namespace 0 Crawlers */}
          <Card className="space-y-3 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Category Search Input with Autocomplete Dropdown */}
              <div className="relative flex-1">
                <div className="relative flex items-center">
                  <Search className="text-label-secondary absolute left-3 h-3.5 w-3.5" />
                  <Input
                    value={categorySearchQuery}
                    onChange={(e) => {
                      setCategorySearchQuery(e.target.value);
                      setIsCategoryDropdownOpen(true);
                    }}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    placeholder={`Search ${globalWikiSource.toUpperCase()} categories (e.g. IXWB, Countries, Wars, Treaties)...`}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm) pr-24 pl-9"
                  />
                  {categorySearchQuery.trim() && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isCrawlingCategory}
                      onClick={() => handleCrawlCategory(categorySearchQuery)}
                      className="absolute right-1"
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
                    <div className="border-separator bg-surface-elevated rounded-row shadow-floating absolute top-10 right-0 left-0 z-50 max-h-48 overflow-y-auto border p-2">
                      <div className="text-label-secondary border-separator text-caption flex items-center justify-between border-b px-2 pb-1">
                        <span>Matching {globalWikiSource.toUpperCase()} Categories</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsCategoryDropdownOpen(false)}
                        >
                          Close
                        </Button>
                      </div>
                      <FacetListSection
                        variant="plain"
                        aria-label={`Matching ${globalWikiSource.toUpperCase()} categories`}
                      >
                        {categorySearchData.categories.map((cat) => (
                          <FacetRow
                            key={cat}
                            onClick={() => handleCrawlCategory(cat)}
                            leading={<BookOpen aria-hidden className="text-purple size-3.5" />}
                            title={cat}
                            trailing={
                              <span className="text-label-secondary text-footnote">
                                Crawl Category →
                              </span>
                            }
                          />
                        ))}
                      </FacetListSection>
                    </div>
                  )}
              </div>

              {/* Crawl All Namespace 0 (Main Pages) Action Button */}
              <Button
                size="sm"
                variant="secondary"
                disabled={isCrawlingAllPages}
                onClick={handleCrawlAllMainPages}
                title={`Fetch all articles in the main namespace (namespace 0) on ${globalWikiSource.toUpperCase()}`}
                className="shrink-0"
              >
                {isCrawlingAllPages ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="text-purple mr-2 h-3.5 w-3.5" />
                )}
                Parse All {globalWikiSource.toUpperCase()} Main Pages (Namespace 0)
              </Button>
            </div>
          </Card>

          {/* Manual Input Box */}
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <label className="text-label text-caption flex items-center gap-2">
                <FileText className="text-tint h-4 w-4" />
                Add Articles & Categories to Queue (Comma or Newline Separated)
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddArticlesFromText}
                disabled={!articleInput.trim()}
              >
                Add to Queue
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

          {/* Batch Candidate Queue Table */}
          {candidates.length > 0 && (
            <Card className="space-y-3 overflow-hidden p-4">
              <div className="border-separator flex flex-col gap-2 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="text-purple h-4 w-4" />
                  <span className="text-label text-caption">
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

                    title="Remove duplicate articles currently in this queue"
                  >
                    <Layers className="text-purple mr-1 h-3.5 w-3.5" /> Deduplicate Queue
                  </Button>

                  {/* Purge Database Duplicates Button */}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setIsPurgeDialogOpen(true)}
                    disabled={isProcessingBatch}

                    title="Scan and purge duplicate cards from the database"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Purge DB Duplicates (
                    {duplicateStats?.totalDuplicates ?? 0})
                  </Button>

                  {/* Backfill Authors Button */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsBackfillDialogOpen(true)}
                    disabled={isProcessingBatch}

                    title="Backfill page creator and contributor attribution for existing lore cards"
                  >
                    <Sparkles className="text-yellow mr-1 h-3.5 w-3.5" /> Backfill Wiki Authors
                  </Button>

                  {/* Re-Catalog Categories Button */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsReclassifyDialogOpen(true)}
                    disabled={isProcessingBatch}

                    title="Re-scan and categorize lore cards with multi-signal infobox & category tree classifier"
                  >
                    <Layers className="text-purple mr-1 h-3.5 w-3.5" /> Re-Catalog Categories
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCandidates([])}
                    disabled={isProcessingBatch}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear All
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleProcessBatch}
                    disabled={isProcessingBatch || candidates.every((c) => c.status !== "idle")}
                  >
                    {isProcessingBatch ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Generating Batch...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-3.5 w-3.5" />
                        Mint Batch Lore Cards (
                        {candidates.filter((c) => c.status === "idle").length})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Queue status filter */}
              <SegmentedControl
                size="sm"
                aria-label="Queue status"
                className="mt-1"
                value={candidateStatusFilter}
                onValueChange={setCandidateStatusFilter}
                options={[
                  { value: "ALL", label: `All (${candidates.length})` },
                  { value: "idle", label: `Queued (${idleCount})` },
                  { value: "generating", label: `Generating (${generatingCount})` },
                  { value: "success", label: `Minted (${successCount})` },
                  ...(errorCount > 0
                    ? [{ value: "error" as const, label: `Failed (${errorCount})` }]
                    : []),
                ]}
              />

              {/* Failed Imports Diagnostic Alert Banner */}
              {errorCount > 0 && (
                <div className="rounded-row border-red/30 bg-red/10 text-footnote flex flex-col justify-between gap-3 border p-3 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="text-red mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="text-red font-semibold">
                        {errorCount} candidate{errorCount > 1 ? "s" : ""} failed during generation
                      </div>
                      <div className="text-label-secondary text-footnote mt-0.5">
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
                      className="text-destructive"
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy Error Log
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleClearFailed}>
                      <Trash2 className="mr-1 h-3 w-3" /> Clear Failed
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRetryAllFailed}
                      disabled={isProcessingBatch}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Retry All Failed ({errorCount})
                    </Button>
                  </div>
                </div>
              )}

              <Table containerClassName="max-h-[440px]">
                <TableHeader sticky>
                  <TableRow>
                    <TableHead className="w-14 px-3 text-center">Artwork</TableHead>
                    <TableHead className="px-4">Article Title</TableHead>
                    <TableHead className="px-4">Source</TableHead>
                    <TableHead className="px-4">Target Rarity</TableHead>
                    <TableHead className="px-4">Season</TableHead>
                    <TableHead className="px-4">Status & Error Diagnostics</TableHead>
                    <TableHead className="px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((c) => {
                    const artworkToShow = c.mintedArtwork || c.imageUrl;
                    return (
                      <TableRow key={c.id}>
                        {/* Artwork Thumbnail / Clickable Image */}
                        <TableCell className="px-3 text-center">
                          {artworkToShow ? (
                            <Button
                              variant="secondary"
                              size="icon-lg"
                              aria-label={`Inspect artwork for ${c.articleTitle}`}
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
                              className="group border-separator mx-auto size-10 overflow-hidden border bg-black/40 p-0"
                              title="Click to inspect full image"
                            >
                              <img
                                src={artworkToShow}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <span
                                aria-hidden
                                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <Eye className="size-3.5 text-white" />
                              </span>
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="icon-lg"
                              aria-label={`Inspect details for ${c.articleTitle} (no image)`}
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
                              className="border-separator text-label-secondary hover:text-label mx-auto size-10 border"
                              title="No primary image parsed. Click to inspect details"
                            >
                              <ImageIcon aria-hidden className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>

                        <TableCell className="text-label min-w-64 px-4 font-semibold whitespace-normal">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span>{c.articleTitle}</span>
                              {c.category && <Badge variant="tinted">{c.category}</Badge>}
                            </div>
                            {c.author &&
                              c.author !== "Unknown" &&
                              !c.author.toLowerCase().includes("community") && (
                                <span className="text-caption text-yellow line-clamp-1">
                                  ✍️ {c.author}
                                </span>
                              )}
                            {c.extract &&
                              (!c.author ||
                                c.author === "Unknown" ||
                                c.author.toLowerCase().includes("community")) && (
                                <span className="text-label-secondary text-footnote line-clamp-1 font-normal">
                                  {c.extract}
                                </span>
                              )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4">
                          {c.wikiSource === "iiwiki" ? (
                            <IIWikiBadge size="xs" />
                          ) : (
                            <Badge variant="neutral">{c.wikiSource}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge variant="purple">{c.targetRarity}</Badge>
                        </TableCell>
                        <TableCell className="text-label-secondary px-4">S{c.season}</TableCell>
                        <TableCell className="px-4 whitespace-normal">
                          {c.status === "generating" && (
                            <span className="text-caption text-blue inline-flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                            </span>
                          )}
                          {c.status === "success" && (
                            <span className="text-caption text-green inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Minted (
                              {c.generatedCardId?.slice(0, 8)})
                            </span>
                          )}
                          {c.status === "error" && (
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedErrorCandidate(c)}
                                className="bg-red/15 text-red-ink hover:bg-red/25 self-start rounded-full px-2"
                                title="Click to view full failure diagnostic"
                              >
                                <XCircle aria-hidden />
                                Failed
                              </Button>
                              {c.errorMessage && (
                                <span
                                  onClick={() => setSelectedErrorCandidate(c)}
                                  className="text-caption text-red line-clamp-1 max-w-[240px] cursor-pointer hover:underline"
                                  title={c.errorMessage}
                                >
                                  {c.errorMessage}
                                </span>
                              )}
                            </div>
                          )}
                          {c.status === "idle" && (
                            <span className="text-label-secondary text-footnote inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Queued
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {c.status === "error" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Retry Import"
                                type="button"
                                onClick={() => handleRetryCandidate(c.id)}
                                disabled={isProcessingBatch}

                                title="Retry Import"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {artworkToShow && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Inspect Artwork"
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

                                title="Inspect Artwork"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove Candidate"
                              type="button"
                              onClick={() =>
                                setCandidates((prev) => prev.filter((item) => item.id !== c.id))
                              }

                              title="Remove Candidate"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* ─── TAB 2: USER REQUEST QUEUE ──────────────────────────────── */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {/* Stats Bar */}
          {requestStats.data && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="rounded-row p-3">
                <div className="text-label-secondary text-footnote">Total Requests</div>
                <div className="text-label text-title-3 mt-0.5">{requestStats.data.total}</div>
              </Card>
              <Card className="rounded-row border-yellow/30 bg-yellow/10 p-3">
                <div className="text-label-secondary text-footnote">Pending Approval</div>
                <div className="text-title-3 text-yellow mt-0.5">{requestStats.data.pending}</div>
              </Card>
              <Card className="rounded-row border-green/30 bg-green/10 p-3">
                <div className="text-label-secondary text-footnote">Generated Cards</div>
                <div className="text-title-3 text-green mt-0.5">{requestStats.data.generated}</div>
              </Card>
              <Card className="rounded-row border-red/30 bg-red/10 p-3">
                <div className="text-label-secondary text-footnote">Rejected</div>
                <div className="text-title-3 text-red mt-0.5">{requestStats.data.rejected}</div>
              </Card>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-label-secondary text-caption">Filter Queue:</span>
              <Select value={requestStatusFilter} onValueChange={(v) => setRequestStatusFilter(v)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Requests</SelectItem>
                  <SelectItem value="PENDING">Pending Only</SelectItem>
                  <SelectItem value="APPROVED">Approved Only</SelectItem>
                  <SelectItem value="GENERATED">Generated Only</SelectItem>
                  <SelectItem value="REJECTED">Rejected Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Request Queue Table */}
          {requestQueue.isLoading ? (
            <div className="border-separator bg-surface rounded-row flex h-48 items-center justify-center border">
              <Loader2 className="text-tint h-6 w-6 animate-spin" />
            </div>
          ) : !requestQueue.data || requestQueue.data.requests.length === 0 ? (
            <div className="border-separator bg-surface rounded-row flex h-40 flex-col items-center justify-center border border-dashed">
              <BookOpen className="text-label-tertiary mb-2 h-8 w-8" />
              <p className="text-label text-headline">No requests found in queue</p>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <Table containerClassName="max-h-[500px]">
                <TableHeader sticky>
                  <TableRow>
                    <TableHead className="px-4">Article Title</TableHead>
                    <TableHead className="px-4">Wiki Source</TableHead>
                    <TableHead className="px-4">Requester (Nation / User)</TableHead>
                    <TableHead className="px-4">Requested Date</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestQueue.data.requests.map((request: any) => {
                    const isPending = request.status === "PENDING";
                    const isApproved = request.status === "APPROVED";
                    const isGenerated = request.status === "GENERATED";
                    const isRejected = request.status === "REJECTED";

                    return (
                      <TableRow key={request.id}>
                        <TableCell className="text-label px-4 font-semibold">
                          {request.articleTitle}
                        </TableCell>
                        <TableCell className="px-4">
                          {request.wikiSource === "iiwiki" ? (
                            <IIWikiBadge size="xs" />
                          ) : (
                            <Badge variant="neutral">{request.wikiSource}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-label px-4 font-medium">
                          <Badge variant="tinted" className="gap-2">
                            <UserCheck className="h-3 w-3" />
                            {request.requesterName || request.userId}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-label-secondary px-4">
                          {new Date(request.requestedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="px-4">
                          {isPending && <Badge variant="yellow">Pending</Badge>}
                          {isApproved && <Badge variant="blue">Approved</Badge>}
                          {isGenerated && <Badge variant="green">Generated</Badge>}
                          {isRejected && <Badge variant="red">Rejected</Badge>}
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          <div className="flex justify-end gap-2">
                            {isPending && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => approveMutation.mutate({ requestId: request.id })}
                                  disabled={approveMutation.isPending}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setRejectionRequestId(request.id)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {(isPending || isApproved) && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  generateRequestedMutation.mutate({ requestId: request.id })
                                }
                                disabled={generateRequestedMutation.isPending}
                              >
                                Mint Card
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      <Dialog
        open={rejectionRequestId !== null}
        onOpenChange={(open) => !open && setRejectionRequestId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="text-red h-5 w-5" />
              Reject Lore Card Request & Refund 50 IxC?
            </DialogTitle>
            <DialogDescription>
              Provide an optional reason for the user. The 50 IxC request fee will be automatically
              refunded to their vault.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection (e.g. Article non-existent or duplicate)"
            className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionRequestId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectionRequestId) {
                  rejectMutation.mutate({
                    requestId: rejectionRequestId,
                    reason: rejectionReason || undefined,
                  });
                }
              }}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Artwork & Image Inspector Lightbox Modal ──────────── */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          {previewImage && (
            <div>
              {/* Header */}
              <div className="border-separator flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-row border-purple/30 bg-purple/10 border p-2">
                    <Sparkles className="text-purple h-4 w-4" />
                  </div>
                  <div>
                    <DialogTitle>{previewImage.title}</DialogTitle>
                    <DialogDescription>Parsed Wiki Artwork & Media Inspector</DialogDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {previewImage.wikiSource && (
                    <Badge variant="neutral" className="tabular-nums">
                      {previewImage.wikiSource}
                    </Badge>
                  )}
                  {previewImage.rarity && <Badge variant="purple">{previewImage.rarity}</Badge>}
                </div>
              </div>

              {/* Main Image Stage */}
              <div className="border-separator relative flex max-h-[480px] min-h-[300px] w-full items-center justify-center border-b bg-black/60 p-4">
                {previewImage.imageUrl ? (
                  <img
                    src={previewImage.imageUrl}
                    alt={previewImage.title}
                    className="rounded-row duration-fast max-h-[420px] w-auto max-w-full object-contain transition-transform"
                  />
                ) : (
                  <div className="text-label-secondary flex flex-col items-center justify-center py-12">
                    <ImageIcon className="mb-2 h-12 w-12 stroke-[1.5] opacity-50" />
                    <p className="text-footnote">No primary artwork detected for this article</p>
                  </div>
                )}
              </div>

              {/* Details & Excerpt */}
              <div className="space-y-3 p-6">
                {previewImage.author &&
                  previewImage.author !== "Unknown" &&
                  !previewImage.author.toLowerCase().includes("community") && (
                    <div className="rounded-row border-yellow/30 bg-yellow/10 text-caption text-yellow flex items-center justify-between border p-3">
                      <span className="text-label-secondary text-eyebrow">Wiki Author:</span>
                      <span className="font-semibold">{previewImage.author}</span>
                    </div>
                  )}

                {previewImage.extract && (
                  <div className="bg-surface border-separator text-label-secondary rounded-row text-footnote max-h-24 overflow-y-auto border p-3 leading-relaxed">
                    <p className="text-label text-caption mb-1">Article Summary:</p>
                    {previewImage.extract}
                  </div>
                )}

                {previewImage.imageUrl && (
                  <div className="bg-fill-3 border-separator rounded-row text-footnote flex items-center justify-between border px-3 py-2 font-mono">
                    <span className="text-label-secondary max-w-[400px] truncate">
                      {previewImage.imageUrl}
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(previewImage.imageUrl);
                        notify.success("Copied", "Image URL copied to clipboard.");
                      }}
                      className="ml-2 h-auto shrink-0 gap-1 px-0 font-sans"
                    >
                      <Copy aria-hidden className="size-3.5" /> Copy URL
                    </Button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-separator bg-surface flex items-center justify-between border-t px-6 py-4">
                {previewImage.wikiSource ? (
                  <a
                    href={
                      previewImage.wikiSource === "iiwiki"
                        ? `https://iiwiki.com/wiki/${encodeURIComponent(previewImage.title.replace(/ /g, "_"))}`
                        : `https://ixwiki.com/wiki/${encodeURIComponent(previewImage.title.replace(/ /g, "_"))}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-tint text-caption inline-flex items-center gap-2 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View Wiki Article
                  </a>
                ) : (
                  <div />
                )}
                <Button size="sm" variant="outline" onClick={() => setPreviewImage(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Purge Duplicates Modal ──────────────────────────────── */}
      <Dialog open={isPurgeDialogOpen} onOpenChange={setIsPurgeDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-row border-red/30 bg-red/10 border p-3">
                <Trash2 className="text-red h-5 w-5" />
              </div>
              <div>
                <DialogTitle>
                  Purge Duplicate Cards ({duplicateStats?.totalDuplicates ?? 0} Redundant)
                </DialogTitle>
                <DialogDescription>
                  Safely consolidate duplicate cards and clean up redundant database copies.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="text-footnote space-y-4 py-2">
            <div className="rounded-row border-yellow/30 bg-yellow/10 text-yellow space-y-1 border p-4">
              <p className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                How Duplicate Purging Works:
              </p>
              <p className="text-footnote leading-relaxed opacity-90">
                For each article with duplicate cards, the system selects the highest-level / most
                referenced card as the Primary Keeper. All user ownerships, auctions, and value
                history are re-linked to the keeper card before deleting redundant copies.
              </p>
            </div>

            {duplicateStats?.loreGroups && duplicateStats.loreGroups.length > 0 ? (
              <div className="space-y-2">
                <span className="text-label block font-semibold">
                  Duplicate Groups ({duplicateStats.loreGroups.length} unique articles):
                </span>
                <div className="border-separator bg-surface divide-separator rounded-row max-h-52 divide-y overflow-y-auto border">
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
                      <div key={idx} className="flex items-center justify-between p-3">
                        <div className="min-w-0">
                          <p className="text-label truncate font-semibold">{g.title}</p>
                          <span className="text-label-secondary text-eyebrow tabular-nums">
                            {g.wikiSource}
                          </span>
                        </div>
                        <Badge variant="red">
                          {g.count} copies (+{g.redundantCount} redundant)
                        </Badge>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="text-label-secondary py-4 text-center">
                <CheckCircle2 className="text-green mx-auto mb-2 h-8 w-8 opacity-80" />
                <p className="text-label font-semibold">No Duplicate Lore Cards Found</p>
                <p className="text-footnote">
                  Your database is clean with no redundant lore card records.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsPurgeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={
                purgeDuplicatesMutation.isPending || (duplicateStats?.totalDuplicates ?? 0) === 0
              }
              onClick={() => purgeDuplicatesMutation.mutate({ mode: "wiki_lore" })}
            >
              {purgeDuplicatesMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Purging...
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-row border-yellow/30 bg-yellow/10 border p-3">
                <Sparkles className="text-yellow h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Backfill Wiki Authors</DialogTitle>
                <DialogDescription>
                  Query MediaWiki API to parse and store creator & top contributor attribution on
                  lore cards.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="text-footnote space-y-4 py-2">
            {/* Wiki Source Selector */}
            <div className="border-separator bg-fill-4 rounded-row space-y-2 border p-3">
              <label className="text-label text-caption block">Wiki Source:</label>
              <SegmentedControl
                size="sm"
                fullWidth
                aria-label="Wiki source"
                value={backfillSource}
                onValueChange={(value) => setBackfillSource(value)}
                options={[
                  { value: "all", label: "All Sources" },
                  { value: "ixwiki", label: "IxWiki" },
                  { value: "iiwiki", label: "IIWiki" },
                ]}
              />
            </div>

            {/* Batch Limit Selector */}
            <div className="border-separator bg-fill-4 rounded-row space-y-2 border p-3">
              <label className="text-label text-caption block">Batch Limit:</label>
              <SegmentedControl
                size="sm"
                fullWidth
                aria-label="Batch limit"
                value={String(backfillLimit)}
                onValueChange={(value) => setBackfillLimit(Number(value))}
                options={[50, 100, 250, 500].map((num) => ({
                  value: String(num),
                  label: `${num} Cards`,
                }))}
              />
            </div>
            <p className="text-label-secondary text-footnote leading-relaxed">
              This will find lore cards from{" "}
              <strong className="text-label">
                {backfillSource === "all" ? "all wikis" : backfillSource.toUpperCase()}
              </strong>{" "}
              without saved{" "}
              <code className="rounded-control-sm bg-yellow/10 text-yellow px-1 py-0.5 tabular-nums">
                authorInfo
              </code>
              , fetch their revision history to locate human page creators and top editors, and
              persist the attribution to the database.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsBackfillDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={backfillAuthorsMutation.isPending}
              onClick={() =>
                backfillAuthorsMutation.mutate({ limit: backfillLimit, wikiSource: backfillSource })
              }
            >
              {backfillAuthorsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Backfilling...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3.5 w-3.5" /> Start Backfill ({backfillLimit})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Re-Catalog Categories Modal ──────────────────────────── */}
      <Dialog open={isReclassifyDialogOpen} onOpenChange={setIsReclassifyDialogOpen}>
        <DialogContent className="max-w-md space-y-4 p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-row border-purple/30 bg-purple/10 border p-3">
                <Layers className="text-purple h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Re-Catalog Lore Categories</DialogTitle>
                <DialogDescription>
                  Re-evaluate existing lore cards using Infobox template and category tree scoring.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="text-footnote space-y-4 py-2">
            {/* Wiki Source Selector */}
            <div className="border-separator bg-fill-4 rounded-row space-y-2 border p-3">
              <label className="text-label text-caption block">Wiki Source:</label>
              <SegmentedControl
                size="sm"
                fullWidth
                aria-label="Wiki source"
                value={reclassifySource}
                onValueChange={(value) => setReclassifySource(value)}
                options={[
                  { value: "all", label: "All Sources" },
                  { value: "ixwiki", label: "IxWiki" },
                  { value: "iiwiki", label: "IIWiki" },
                ]}
              />
            </div>

            {/* Batch Limit Selector */}
            <div className="border-separator bg-fill-4 rounded-row space-y-2 border p-3">
              <label className="text-label text-caption block">Batch Limit:</label>
              <SegmentedControl
                size="sm"
                fullWidth
                aria-label="Batch limit"
                value={String(reclassifyLimit)}
                onValueChange={(value) => setReclassifyLimit(Number(value))}
                options={[50, 100, 250, 500].map((num) => ({
                  value: String(num),
                  label: `${num} Cards`,
                }))}
              />
            </div>

            {/* Overwrite Toggle */}
            <div className="border-separator bg-fill-4 rounded-row flex items-center justify-between border p-3">
              <div>
                <span id="reclassify-force-label" className="text-label text-caption block">
                  Force Overwrite
                </span>
                <span id="reclassify-force-hint" className="text-label-secondary text-footnote">
                  Re-classify all cards, not just unclassified/defaults
                </span>
              </div>
              <Checkbox
                aria-labelledby="reclassify-force-label"
                aria-describedby="reclassify-force-hint"
                checked={reclassifyForce}
                onCheckedChange={(checked) => setReclassifyForce(checked === true)}
              />
            </div>

            <p className="text-label-secondary text-footnote leading-relaxed">
              This will analyze lore cards from{" "}
              <strong className="text-label">
                {reclassifySource === "all" ? "all wikis" : reclassifySource.toUpperCase()}
              </strong>{" "}
              against the 12 canonical LoreCategory enums, matching infobox types (e.g.
              officeholders, treaties, battles, settlements) and persisting accurate category seals.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsReclassifyDialogOpen(false)}>
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
            >
              {reclassifyCategoriesMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Classifying...
                </>
              ) : (
                <>
                  <Layers className="mr-2 h-3.5 w-3.5" /> Start Re-Catalog ({reclassifyLimit})
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
        <DialogContent className="max-w-md space-y-4 p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-row border-red/30 bg-red/10 border p-3">
                <AlertTriangle className="text-red h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Import Failure Diagnostics</DialogTitle>
                <DialogDescription>
                  Troubleshooting details for why this lore card failed to generate.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedErrorCandidate && (
            <div className="text-footnote space-y-3 py-1">
              <div className="border-separator bg-fill-3 rounded-row space-y-2 border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Article Title:</span>
                  <span className="text-label font-semibold">
                    {selectedErrorCandidate.articleTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Wiki Source:</span>
                  <span className="text-label font-semibold uppercase">
                    {selectedErrorCandidate.wikiSource}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Target Rarity:</span>
                  <span className="text-purple font-semibold">
                    {selectedErrorCandidate.targetRarity}
                  </span>
                </div>
              </div>

              <div className="rounded-row border-red/30 bg-red/10 space-y-2 border p-3">
                <div className="text-caption text-red flex items-center gap-2">
                  <XCircle className="text-red h-4 w-4" /> Error Reason
                </div>
                <div className="text-footnote text-red leading-relaxed break-words whitespace-pre-wrap tabular-nums">
                  {selectedErrorCandidate.errorMessage ||
                    "Unknown error occurred during generation."}
                </div>
              </div>

              <div className="border-separator bg-surface text-label-secondary rounded-row text-footnote space-y-1 border p-3">
                <div className="text-label flex items-center gap-1 font-semibold">
                  <Info className="text-tint h-3.5 w-3.5" /> Troubleshooting Tips:
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
            <Button variant="outline" size="sm" onClick={() => setSelectedErrorCandidate(null)}>
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
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Retry Import Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
