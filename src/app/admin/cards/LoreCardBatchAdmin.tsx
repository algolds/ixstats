// src/app/admin/cards/LoreCardBatchAdmin.tsx
// Unified Theme-Compliant Apple Design Lore Card Batch Generator & User Request Queue
"use client";

import { useState, useMemo, useRef } from "react";
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
import {
  Download,
  Search,
  Check,
  X,
  AlertCircle,
  BookOpen,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Upload,
  UserCheck,
  Sliders,
  Layers,
  FileText,
  FileSpreadsheet,
  Trash2,
  Play,
} from "lucide-react";
import type { CardRarity } from "@prisma/client";

// Category Preset Crawlers
const CATEGORY_PRESETS = [
  { name: "Top Nations & Realms", tag: "Nations", icon: Globe, terms: ["Valoria", "Ixnay", "Eldoria", "Novaria", "Aethelgard"] },
  { name: "Historic Battles & Wars", tag: "Military", icon: Layers, terms: ["Battle of Ixnay", "Great Sol War", "Siege of Valoria"] },
  { name: "National Monuments", tag: "Monuments", icon: BookOpen, terms: ["Grand Citadel", "Imperial Spire", "Hall of Sovereigns"] },
  { name: "Space & Orbital Programs", tag: "Space", icon: Globe, terms: ["Astra Orbital", "Lunar Colony", "Sol Relay"] },
] as const;

interface BatchCandidate {
  id: string;
  articleTitle: string;
  wikiSource: "ixwiki" | "iiwiki";
  targetRarity: CardRarity | "AUTO";
  season: number;
  customPrompt?: string;
  status: "idle" | "generating" | "success" | "error";
  errorMessage?: string;
  generatedCardId?: string;
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
  const [globalPromptModifier, setGlobalPromptModifier] = useState("");

  // Batch candidate queue
  const [candidates, setCandidates] = useState<BatchCandidate[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Rejection modal
  const [rejectionRequestId, setRejectionRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = api.useUtils();

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

  // Add items from text input
  const handleAddArticlesFromText = () => {
    if (!articleInput.trim()) return;
    const lines = articleInput
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const newCandidates: BatchCandidate[] = lines.map((title, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      articleTitle: title,
      wikiSource: globalWikiSource,
      targetRarity: globalTargetRarity,
      season: globalSeason,
      customPrompt: globalPromptModifier || undefined,
      status: "idle",
    }));

    setCandidates((prev) => [...prev, ...newCandidates]);
    setArticleInput("");
    notify.success("Articles Added", `Added ${newCandidates.length} candidate(s) to the batch queue.`);
  };

  // Preset Crawler Loader
  const handleApplyPreset = (preset: typeof CATEGORY_PRESETS[number]) => {
    const newCandidates: BatchCandidate[] = preset.terms.map((title, i) => ({
      id: `preset-${Date.now()}-${i}`,
      articleTitle: title,
      wikiSource: globalWikiSource,
      targetRarity: globalTargetRarity,
      season: globalSeason,
      customPrompt: globalPromptModifier ? `${globalPromptModifier}, ${preset.name}` : preset.name,
      status: "idle",
    }));

    setCandidates((prev) => [...prev, ...newCandidates]);
    notify.success("Preset Applied", `Loaded ${newCandidates.length} articles from "${preset.name}".`);
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
          notify.success("JSON Imported", `Imported ${newCandidates.length} candidates from JSON.`);
        } else {
          // CSV Parse
          const lines = text.split("\n").filter((l) => l.trim().length > 0);
          const newCandidates: BatchCandidate[] = [];
          lines.forEach((line, i) => {
            const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
            if (cols[0] && cols[0].toLowerCase() !== "title" && cols[0].toLowerCase() !== "articletitle") {
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
          notify.success("CSV Imported", `Imported ${newCandidates.length} candidates from CSV.`);
        }
      } catch (err) {
        notify.error("Import Error", "Failed to parse file. Ensure valid JSON or CSV format.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Export Batch to JSON
  const handleExportJSON = () => {
    if (candidates.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(candidates, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lore_batch_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    notify.success("Batch Exported", "Exported candidates to JSON.");
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
        prev.map((c) => (c.id === item.id ? { ...c, status: "generating" } : c))
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
              ? { ...c, status: "success", generatedCardId: res.cardId }
              : c
          )
        );
        successCount++;
      } catch (err: any) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === item.id
              ? { ...c, status: "error", errorMessage: err?.message || "Generation failed" }
              : c
          )
        );
        failCount++;
      }
    }

    setIsProcessingBatch(false);
    notify.success("Batch Process Complete", `Finished: ${successCount} minted, ${failCount} failed.`);
  };

  return (
    <FacetCard depth={2} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-xl shadow-xl space-y-6 text-card-foreground">
      {/* ─── Header & Sub-Tab Navigation Bar ────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5 backdrop-blur-md">
            <BookOpen className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-foreground tracking-tight text-xl font-bold">
              Lore Card Batch Studio & Requests
            </h2>
            <p className="text-muted-foreground text-xs font-medium">
              AI wiki card generation, category preset crawlers, CSV/JSON bulk import, and request queue.
            </p>
          </div>
        </div>

        {/* Sub-Tab Switcher */}
        <FacetContainer depth={1} enableRefraction={true} className="bg-card/60 p-1 rounded-xl border border-border backdrop-blur-md flex items-center gap-1">
          <button
            onClick={() => setActiveTab("generator")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "generator"
                ? "bg-primary/15 border border-primary/40 text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Batch Studio ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "requests"
                ? "bg-primary/15 border border-primary/40 text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            User Queue ({requestStats.data?.pending ?? 0})
          </button>
        </FacetContainer>
      </div>

      {/* ─── TAB 1: BATCH GENERATOR STUDIO ──────────────────────────── */}
      {activeTab === "generator" && (
        <div className="space-y-6">
          {/* Global Parameter Controls */}
          <FacetContainer depth={1} enableRefraction={true} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-md space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Sliders className="h-4 w-4 text-purple-500" />
              <span>Batch Generation Parameters</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {/* Wiki Source */}
              <div>
                <label className="text-muted-foreground text-[11px] font-medium block mb-1">
                  Default Wiki Source
                </label>
                <select
                  value={globalWikiSource}
                  onChange={(e) => setGlobalWikiSource(e.target.value as any)}
                  className="h-8.5 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ixwiki" className="bg-card text-card-foreground">IxWiki (Primary)</option>
                  <option value="iiwiki" className="bg-card text-card-foreground">IIWiki (Secondary)</option>
                </select>
              </div>

              {/* Target Rarity */}
              <div>
                <label className="text-muted-foreground text-[11px] font-medium block mb-1">
                  Target Rarity Strategy
                </label>
                <select
                  value={globalTargetRarity}
                  onChange={(e) => setGlobalTargetRarity(e.target.value as any)}
                  className="h-8.5 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="AUTO" className="bg-card text-card-foreground">Auto (AI-determined)</option>
                  <option value="COMMON" className="bg-card text-card-foreground">Common</option>
                  <option value="UNCOMMON" className="bg-card text-card-foreground">Uncommon</option>
                  <option value="RARE" className="bg-card text-card-foreground">Rare</option>
                  <option value="ULTRA_RARE" className="bg-card text-card-foreground">Ultra Rare</option>
                  <option value="EPIC" className="bg-card text-card-foreground">Epic</option>
                  <option value="LEGENDARY" className="bg-card text-card-foreground">Legendary</option>
                </select>
              </div>

              {/* Card Season */}
              <div>
                <label className="text-muted-foreground text-[11px] font-medium block mb-1">
                  Target Card Season
                </label>
                <select
                  value={globalSeason}
                  onChange={(e) => setGlobalSeason(parseInt(e.target.value, 10))}
                  className="h-8.5 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={1} className="bg-card text-card-foreground">Season 1</option>
                  <option value={2} className="bg-card text-card-foreground">Season 2</option>
                  <option value={3} className="bg-card text-card-foreground">Season 3</option>
                </select>
              </div>
            </div>
          </FacetContainer>

          {/* Quick Category Presets & Bulk Import Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-amber-500" /> Category Presets:
              </span>
              {CATEGORY_PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.name}
                    onClick={() => handleApplyPreset(preset)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all shadow-2xs"
                  >
                    <Icon className="h-3 w-3 text-purple-500" />
                    {preset.name}
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
                className="h-8 rounded-xl border-border bg-card text-xs font-semibold text-foreground hover:bg-accent active:scale-95 transition-all"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV/JSON
              </Button>
              {candidates.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportJSON}
                  className="h-8 rounded-xl border-border bg-card text-xs font-semibold text-foreground hover:bg-accent active:scale-95 transition-all"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export JSON
                </Button>
              )}
            </div>
          </div>

          {/* Manual Input Box */}
          <FacetContainer depth={1} enableRefraction={true} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-foreground text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                Add Articles to Queue (Comma or Newline Separated)
              </label>
              <Button
                size="sm"
                onClick={handleAddArticlesFromText}
                disabled={!articleInput.trim()}
                className="h-7 rounded-lg border border-primary/30 bg-primary/20 text-xs font-semibold text-primary hover:bg-primary/30 active:scale-95 transition-all"
              >
                Add to Queue
              </Button>
            </div>
            <textarea
              value={articleInput}
              onChange={(e) => setArticleInput(e.target.value)}
              placeholder="e.g. Empire of Valoria, Treaty of Sol, Grand Cathedral of Ixnay..."
              className="h-20 w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
            />
          </FacetContainer>

          {/* Batch Candidate Queue Table */}
          {candidates.length > 0 && (
            <FacetContainer depth={1} enableRefraction={true} className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-md shadow-inner space-y-3 p-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-500" />
                  <span className="text-foreground text-xs font-bold">
                    Batch Candidates Queue ({candidates.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCandidates([])}
                    disabled={isProcessingBatch}
                    className="h-7 rounded-lg px-2 text-rose-500 hover:bg-rose-500/10 text-xs font-medium"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear All
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleProcessBatch}
                    disabled={isProcessingBatch || candidates.every((c) => c.status !== "idle")}
                    className="h-8 rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition-all shadow-xs"
                  >
                    {isProcessingBatch ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Generating Batch...
                      </>
                    ) : (
                      <>
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Mint Batch Lore Cards ({candidates.filter((c) => c.status === "idle").length})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xl text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Article Title</th>
                      <th className="px-4 py-2.5">Source</th>
                      <th className="px-4 py-2.5">Target Rarity</th>
                      <th className="px-4 py-2.5">Season</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {candidates.map((c) => (
                      <tr key={c.id} className="hover:bg-accent/40 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-foreground">
                          {c.articleTitle}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-bold text-foreground">
                            {c.wikiSource}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-300">
                            {c.targetRarity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          S{c.season}
                        </td>
                        <td className="px-4 py-2.5">
                          {c.status === "generating" && (
                            <span className="inline-flex items-center gap-1 text-blue-500 font-semibold text-[11px]">
                              <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                            </span>
                          )}
                          {c.status === "success" && (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold text-[11px]">
                              <CheckCircle2 className="h-3 w-3" /> Minted ({c.generatedCardId?.slice(0, 8)})
                            </span>
                          )}
                          {c.status === "error" && (
                            <span className="inline-flex items-center gap-1 text-rose-500 font-semibold text-[11px]" title={c.errorMessage}>
                              <XCircle className="h-3 w-3" /> Error
                            </span>
                          )}
                          {c.status === "idle" && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground text-[11px]">
                              <Clock className="h-3 w-3" /> Queued
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setCandidates((prev) => prev.filter((item) => item.id !== c.id))}
                            className="rounded p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                            title="Remove Candidate"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
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
              <FacetCard depth={1} interactive="hover" className="rounded-xl border border-border bg-card/70 p-3 backdrop-blur-md">
                <div className="text-muted-foreground text-[11px]">Total Requests</div>
                <div className="text-lg font-bold text-foreground mt-0.5">{requestStats.data.total}</div>
              </FacetCard>
              <FacetCard depth={1} interactive="hover" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 backdrop-blur-md">
                <div className="text-muted-foreground text-[11px]">Pending Approval</div>
                <div className="text-lg font-bold text-amber-500 dark:text-amber-300 mt-0.5">{requestStats.data.pending}</div>
              </FacetCard>
              <FacetCard depth={1} interactive="hover" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 backdrop-blur-md">
                <div className="text-muted-foreground text-[11px]">Generated Cards</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{requestStats.data.generated}</div>
              </FacetCard>
              <FacetCard depth={1} interactive="hover" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 backdrop-blur-md">
                <div className="text-muted-foreground text-[11px]">Rejected</div>
                <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">{requestStats.data.rejected}</div>
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
                className="h-8.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition-all hover:bg-accent focus:outline-none"
              >
                <option value="ALL" className="bg-card text-card-foreground">All Requests</option>
                <option value="PENDING" className="bg-card text-card-foreground">Pending Only</option>
                <option value="APPROVED" className="bg-card text-card-foreground">Approved Only</option>
                <option value="GENERATED" className="bg-card text-card-foreground">Generated Only</option>
                <option value="REJECTED" className="bg-card text-card-foreground">Rejected Only</option>
              </select>
            </div>
          </div>

          {/* Request Queue Table */}
          {requestQueue.isLoading ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card/40 backdrop-blur-md">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !requestQueue.data || requestQueue.data.requests.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 backdrop-blur-md">
              <BookOpen className="h-8 w-8 text-muted-foreground/40 mb-1.5" />
              <p className="text-foreground text-sm font-semibold">No requests found in queue</p>
            </div>
          ) : (
            <FacetContainer depth={1} enableRefraction={true} className="overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-md shadow-inner">
              <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xl text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Article Title</th>
                      <th className="px-4 py-3">Wiki Source</th>
                      <th className="px-4 py-3">Requester (Nation / User)</th>
                      <th className="px-4 py-3">Requested Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {requestQueue.data.requests.map((request: any) => {
                      const isPending = request.status === "PENDING";
                      const isApproved = request.status === "APPROVED";
                      const isGenerated = request.status === "GENERATED";
                      const isRejected = request.status === "REJECTED";

                      return (
                        <tr key={request.id} className="hover:bg-accent/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {request.articleTitle}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-bold text-foreground">
                              {request.wikiSource}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                              <UserCheck className="h-3 w-3" />
                              {request.requesterName || request.userId}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {isPending && (
                              <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-500 dark:text-amber-300">
                                Pending
                              </span>
                            )}
                            {isApproved && (
                              <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-300">
                                Approved
                              </span>
                            )}
                            {isGenerated && (
                              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                                Generated
                              </span>
                            )}
                            {isRejected && (
                              <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300">
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
                                    onClick={() => approveMutation.mutate({ requestId: request.id })}
                                    disabled={approveMutation.isPending}
                                    className="h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[11px] font-semibold"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRejectionRequestId(request.id)}
                                    className="h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 text-[11px] font-semibold"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              {(isPending || isApproved) && (
                                <Button
                                  size="sm"
                                  onClick={() => generateRequestedMutation.mutate({ requestId: request.id })}
                                  disabled={generateRequestedMutation.isPending}
                                  className="h-7 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 text-[11px] font-semibold"
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
      <Dialog open={rejectionRequestId !== null} onOpenChange={(open) => !open && setRejectionRequestId(null)}>
        <DialogContent className="border border-border bg-card text-card-foreground shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              Reject Lore Card Request & Refund 50 IxC?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Provide an optional reason for the user. The 50 IxC request fee will be automatically refunded to their vault.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection (e.g. Article non-existent or duplicate)"
            className="h-9 rounded-xl border-border bg-card text-xs text-foreground placeholder:text-muted-foreground"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionRequestId(null)}>Cancel</Button>
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
              className="bg-rose-500 text-white font-semibold hover:bg-rose-600"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FacetCard>
  );
}
