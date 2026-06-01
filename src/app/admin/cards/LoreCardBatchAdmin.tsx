// src/app/admin/cards/LoreCardBatchAdmin.tsx
// Reusable lore card batch generator component for admin tabs

"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { Card } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { useNotify } from "~/hooks/useNotify";
import {
  Download,
  Search,
  Sparkles,
  Check,
  X,
  AlertCircle,
  BookOpen,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";

// Wiki sources
const WIKI_SOURCES = [
  { value: "ixwiki", label: "IxWiki", icon: Globe },
  { value: "iiwiki", label: "IIWiki", icon: BookOpen },
  { value: "both", label: "Both Wikis", icon: Sparkles },
] as const;

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
  COMMON: "text-muted-foreground bg-muted/50",
  UNCOMMON: "text-green-400 bg-green-500/20",
  RARE: "text-blue-400 bg-blue-500/20",
  ULTRA_RARE: "text-purple-400 bg-purple-500/20",
  EPIC: "text-orange-400 bg-orange-500/20",
  LEGENDARY: "text-yellow-400 bg-yellow-500/20",
};

interface ArticlePreview {
  title: string;
  excerpt: string;
  qualityScore: number;
  estimatedRarity: string;
  wikiSource: string;
  artwork?: string;
  hasImage?: boolean;
  approved: boolean;
  generating?: boolean;
  generated?: boolean;
  error?: string;
}

export function LoreCardBatchAdmin() {
  const notify = useNotify();

  const [activeSubTab, setActiveSubTab] = useState<"generator" | "requests">("generator");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("ALL");
  const [rejectionRequestId, setRejectionRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = api.useUtils();
  const requestStats = api.loreCards.getRequestStats.useQuery(undefined, {
    enabled: activeSubTab === "requests",
  });

  const statusParam = requestStatusFilter === "ALL" ? undefined : (requestStatusFilter as any);
  const requestQueue = api.loreCards.getRequestQueue.useQuery(
    { status: statusParam, limit: 50 },
    { enabled: activeSubTab === "requests" }
  );

  const approveMutation = api.loreCards.approveRequest.useMutation({
    onSuccess: (data) => {
      notify.success("Request Approved", data.message || "Request approved.");
      utils.loreCards.getRequestQueue.invalidate();
      utils.loreCards.getRequestStats.invalidate();
    },
    onError: (err) => {
      notify.error("Error", err.message);
    },
  });

  const rejectMutation = api.loreCards.rejectRequest.useMutation({
    onSuccess: (data) => {
      notify.success("Request Rejected", data.message || "Request rejected and refunded.");
      setRejectionRequestId(null);
      setRejectionReason("");
      utils.loreCards.getRequestQueue.invalidate();
      utils.loreCards.getRequestStats.invalidate();
    },
    onError: (err) => {
      notify.error("Error", err.message);
    },
  });

  const generateCardMutation = api.loreCards.generateRequestedCard.useMutation({
    onSuccess: (data) => {
      notify.success("Card Generated", data.message || "Lore card generated successfully.");
      utils.loreCards.getRequestQueue.invalidate();
      utils.loreCards.getRequestStats.invalidate();
    },
    onError: (err) => {
      notify.error("Generation Failed", err.message);
    },
  });

  const [wikiSource, setWikiSource] = useState<"ixwiki" | "iiwiki" | "both">("both");
  const [articleCount, setArticleCount] = useState<number>(20);
  const [articles, setArticles] = useState<ArticlePreview[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [qualityFilter, setQualityFilter] = useState<number>(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [generationResults, setGenerationResults] = useState<{
    success: number;
    failed: number;
    skipped: number;
  }>({ success: 0, failed: 0, skipped: 0 });

  // Fetch articles (concurrent previews, prefer images, enforce min quality)
  const handleFetchArticles = async () => {
    const MIN_QUALITY = 20; // enforce minimum quality when finding lore cards

    if (articleCount < 10 || articleCount > 100) {
      notify.error("Invalid Count", "Please enter a number between 10 and 100");
      return;
    }

    setIsFetching(true);
    setArticles([]);
    setGenerationResults({ success: 0, failed: 0, skipped: 0 });

    try {
      const sources = wikiSource === "both" ? ["ixwiki", "iiwiki"] : [wikiSource];
      // Fetch more candidates to compensate for filtering (images / quality)
      const MULTIPLIER = 3;
      const articlesPerSource = Math.ceil((articleCount * MULTIPLIER) / sources.length);
      const allArticles: ArticlePreview[] = [];

      for (const source of sources) {
        const url = `/api/wiki/random-articles?source=${source}&count=${articlesPerSource}&minQuality=${MIN_QUALITY}&preferImages=true`;
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Random articles preview failed for ${source}`);
          continue;
        }

        const data = await response.json();
        const previews: any[] = data.articles || [];

        for (const preview of previews) {
          const q = preview.qualityScore || 0;
          const artwork = preview.artwork || null;
          const hasImage = !!artwork && !artwork.includes("placeholder");

          allArticles.push({
            title: preview.title,
            excerpt: preview.excerpt || "No excerpt available",
            qualityScore: q,
            estimatedRarity: preview.estimatedRarity || "COMMON",
            wikiSource: preview.wikiSource || source,
            approved: true,
            artwork,
            hasImage,
          });
        }
      }

      // Prefer articles with images, then highest quality
      allArticles.sort((a, b) => {
        if ((b.hasImage ? 1 : 0) !== (a.hasImage ? 1 : 0)) return (b.hasImage ? 1 : 0) - (a.hasImage ? 1 : 0);
        return b.qualityScore - a.qualityScore;
      });

      setArticles(allArticles.slice(0, articleCount));
      notify.success("Articles Fetched", `Found ${allArticles.length} eligible articles`);
    } catch (error) {
      console.error("Error fetching articles:", error);
      notify.error("Error", error instanceof Error ? error.message : "Failed to fetch articles");
    } finally {
      setIsFetching(false);
    }
  };

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      if (searchQuery && !article.title.toLowerCase().includes(searchQuery.toLowerCase()))
        return false;
      if (qualityFilter > 0 && article.qualityScore < qualityFilter) return false;
      return true;
    });
  }, [articles, searchQuery, qualityFilter]);

  const handleBulkApprove = () => {
    setArticles((prev) =>
      prev.map((article) => ({
        ...article,
        approved: filteredArticles.some((fa) => fa.title === article.title)
          ? true
          : article.approved,
      }))
    );
  };

  const handleBulkReject = () => {
    setArticles((prev) =>
      prev.map((article) => ({
        ...article,
        approved: filteredArticles.some((fa) => fa.title === article.title)
          ? false
          : article.approved,
      }))
    );
  };

  const toggleApproval = (title: string) => {
    setArticles((prev) =>
      prev.map((article) =>
        article.title === title ? { ...article, approved: !article.approved } : article
      )
    );
  };

  const handleGenerateCards = async () => {
    const approvedArticles = articles.filter((a) => a.approved);
    if (approvedArticles.length === 0) {
      notify.warning("No Articles Selected", "Please approve at least one article");
      return;
    }

    setShowConfirmDialog(false);
    setIsGenerating(true);
    setGenerationProgress({ current: 0, total: approvedArticles.length });
    setGenerationResults({ success: 0, failed: 0, skipped: 0 });

    for (let i = 0; i < approvedArticles.length; i++) {
      const article = approvedArticles[i]!;
      setArticles((prev) =>
        prev.map((a) => (a.title === article.title ? { ...a, generating: true } : a))
      );

      try {
        const response = await fetch("/api/wiki/generate-lore-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleTitle: article.title, wikiSource: article.wikiSource }),
        });

        if (response.ok) {
          setArticles((prev) =>
            prev.map((a) =>
              a.title === article.title ? { ...a, generating: false, generated: true } : a
            )
          );
          setGenerationResults((prev) => ({ ...prev, success: prev.success + 1 }));
        } else {
          const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
          setArticles((prev) =>
            prev.map((a) =>
              a.title === article.title
                ? { ...a, generating: false, error: errorData.message || "Failed to generate" }
                : a
            )
          );
          setGenerationResults((prev) =>
            errorData.message?.includes("already exists")
              ? { ...prev, skipped: prev.skipped + 1 }
              : { ...prev, failed: prev.failed + 1 }
          );
        }
      } catch (error) {
        setArticles((prev) =>
          prev.map((a) =>
            a.title === article.title
              ? {
                  ...a,
                  generating: false,
                  error: error instanceof Error ? error.message : "Failed to generate",
                }
              : a
          )
        );
        setGenerationResults((prev) => ({ ...prev, failed: prev.failed + 1 }));
      }

      setGenerationProgress({ current: i + 1, total: approvedArticles.length });
    }

    setIsGenerating(false);
    notify.success(
      "Generation Complete",
      `Success: ${generationResults.success}, Failed: ${generationResults.failed}, Skipped: ${generationResults.skipped}`
    );
  };

  const approvedCount = articles.filter((a) => a.approved).length;
  const generatedCount = articles.filter((a) => a.generated).length;

  return (
    <div className="space-y-6">
      {/* Sub-Tabs Nav */}
      <div className="flex border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveSubTab("generator")}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${
            activeSubTab === "generator"
              ? "border-b-2 border-purple-500 text-purple-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Batch Generator
        </button>
        <button
          onClick={() => setActiveSubTab("requests")}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${
            activeSubTab === "requests"
              ? "border-b-2 border-purple-500 text-purple-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          User Requests Queue
        </button>
      </div>

      {activeSubTab === "generator" ? (
        <div className="space-y-6">
          {/* Controls */}
          <div className="glass-card-child rounded-xl border border-purple-500/20 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Wiki Source
                </label>
                <Select
                  value={wikiSource}
                  onValueChange={(value: any) => setWikiSource(value)}
                  disabled={isFetching || isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIKI_SOURCES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Number of Articles (10-100)
                </label>
                <Input
                  type="number"
                  min={10}
                  max={100}
                  value={articleCount}
                  onChange={(e) => setArticleCount(parseInt(e.target.value) || 20)}
                  disabled={isFetching || isGenerating}
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleFetchArticles}
                  disabled={isFetching || isGenerating}
                  className="w-full bg-purple-500/20 text-purple-500 hover:bg-purple-500/30"
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Fetch Articles
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={approvedCount === 0 || isFetching || isGenerating}
                  className="w-full bg-green-500/20 text-green-500 hover:bg-green-500/30"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate ({approvedCount})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Stats */}
          {articles.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-5">
              <Card className="glass-card-child p-4">
                <p className="text-muted-foreground text-sm">Total Articles</p>
                <p className="text-foreground mt-2 text-3xl font-bold">{articles.length}</p>
              </Card>
              <Card className="glass-card-child p-4">
                <p className="text-muted-foreground text-sm">Approved</p>
                <p className="mt-2 text-3xl font-bold text-green-400">{approvedCount}</p>
              </Card>
              <Card className="glass-card-child p-4">
                <p className="text-muted-foreground text-sm">Generated</p>
                <p className="mt-2 text-3xl font-bold text-blue-400">{generatedCount}</p>
              </Card>
              <Card className="glass-card-child p-4">
                <p className="text-muted-foreground text-sm">Success</p>
                <p className="mt-2 text-3xl font-bold text-green-400">
                  {generationResults.success}
                </p>
              </Card>
              <Card className="glass-card-child p-4">
                <p className="text-muted-foreground text-sm">Failed/Skipped</p>
                <p className="mt-2 text-3xl font-bold text-red-400">
                  {generationResults.failed + generationResults.skipped}
                </p>
              </Card>
            </div>
          )}

          {/* Progress Bar */}
          {isGenerating && (
            <Card className="glass-card-parent p-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-foreground text-lg font-semibold">Generation Progress</h3>
                <span className="text-muted-foreground text-sm">
                  {generationProgress.current} / {generationProgress.total}
                </span>
              </div>
              <div className="bg-muted/50 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                  style={{
                    width: `${(generationProgress.current / generationProgress.total) * 100}%`,
                  }}
                />
              </div>
            </Card>
          )}

          {/* Filters */}
          {articles.length > 0 && (
            <div className="glass-card-parent rounded-xl border border-purple-500/20 p-4">
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search articles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div>
                  <Select
                    value={qualityFilter.toString()}
                    onValueChange={(value) => setQualityFilter(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Min Quality Score" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All Quality Levels</SelectItem>
                      <SelectItem value="20">Quality &gt;= 20</SelectItem>
                      <SelectItem value="40">Quality &gt;= 40</SelectItem>
                      <SelectItem value="60">Quality &gt;= 60</SelectItem>
                      <SelectItem value="80">Quality &gt;= 80</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkApprove}
                    disabled={isGenerating}
                    className="flex-1"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkReject}
                    disabled={isGenerating}
                    className="flex-1"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject All
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Articles Grid */}
          {articles.length === 0 ? (
            <Card className="glass-card-parent p-12 text-center">
              <BookOpen className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground mb-2">No articles fetched yet</p>
              <p className="text-muted-foreground text-sm">
                Configure your settings above and click &quot;Fetch Articles&quot; to begin
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredArticles.map((article) => (
                <ArticlePreviewCard
                  key={`${article.wikiSource}-${article.title}`}
                  article={article}
                  onToggleApproval={() => toggleApproval(article.title)}
                  disabled={isGenerating}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-5">
            <Card className="glass-card-child p-4">
              <p className="text-muted-foreground text-sm">Total Requests</p>
              <p className="text-foreground mt-2 text-3xl font-bold">
                {requestStats.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                ) : (
                  (requestStats.data?.total ?? 0)
                )}
              </p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-muted-foreground text-sm">Pending</p>
              <p className="mt-2 text-3xl font-bold text-yellow-400">
                {requestStats.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
                ) : (
                  (requestStats.data?.pending ?? 0)
                )}
              </p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-muted-foreground text-sm">Approved</p>
              <p className="mt-2 text-3xl font-bold text-blue-400">
                {requestStats.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                ) : (
                  (requestStats.data?.approved ?? 0)
                )}
              </p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-muted-foreground text-sm">Generated</p>
              <p className="mt-2 text-3xl font-bold text-green-400">
                {requestStats.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-green-400" />
                ) : (
                  (requestStats.data?.generated ?? 0)
                )}
              </p>
            </Card>
            <Card className="glass-card-child p-4">
              <p className="text-muted-foreground text-sm">Rejected</p>
              <p className="mt-2 text-3xl font-bold text-red-400">
                {requestStats.isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-red-400" />
                ) : (
                  (requestStats.data?.rejected ?? 0)
                )}
              </p>
            </Card>
          </div>

          {/* Status Filter */}
          <div className="glass-card-parent rounded-xl border border-purple-500/20 p-4">
            <div className="flex flex-wrap gap-2">
              {["ALL", "PENDING", "APPROVED", "GENERATED", "REJECTED"].map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={requestStatusFilter === status ? "default" : "outline"}
                  onClick={() => setRequestStatusFilter(status)}
                  className={
                    requestStatusFilter === status
                      ? "bg-purple-600 font-semibold text-white hover:bg-purple-700"
                      : ""
                  }
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          {/* Requests Queue Table */}
          {requestQueue.isLoading ? (
            <Card className="glass-card-parent p-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-400" />
              <p className="text-muted-foreground mt-2 text-sm">Loading request queue...</p>
            </Card>
          ) : !requestQueue.data?.requests || requestQueue.data.requests.length === 0 ? (
            <Card className="glass-card-parent p-12 text-center">
              <BookOpen className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground mb-2">No requests found</p>
            </Card>
          ) : (
            <div className="glass-card-parent overflow-hidden rounded-xl border border-purple-500/20">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/40 text-xs font-semibold tracking-wider text-white/60 uppercase">
                      <th className="px-6 py-4">Article Title</th>
                      <th className="px-6 py-4">Source</th>
                      <th className="px-6 py-4">Requester</th>
                      <th className="px-6 py-4">Requested At</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/10">
                    {requestQueue.data.requests.map((request: any) => {
                      const isPending = request.status === "PENDING";
                      const isApproved = request.status === "APPROVED";
                      const isRejected = request.status === "REJECTED";
                      const isGenerated = request.status === "GENERATED";

                      return (
                        <tr key={request.id} className="transition-colors hover:bg-white/5">
                          <td className="px-6 py-4 font-semibold text-white">
                            {request.articleTitle}
                          </td>
                          <td className="px-6 py-4 text-white/80">
                            <span className="flex items-center gap-1.5">
                              {request.wikiSource === "ixwiki" ? (
                                <>
                                  <Globe className="h-3.5 w-3.5 text-purple-400" />
                                  IxWiki
                                </>
                              ) : (
                                <>
                                  <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                                  IIWiki
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-white/60">
                            {request.userId.substring(0, 12)}...
                          </td>
                          <td className="px-6 py-4 text-white/60">
                            {new Date(request.requestedAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                                  isPending
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : isApproved
                                      ? "bg-blue-500/20 text-blue-400"
                                      : isGenerated
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {request.status}
                              </span>
                              {isRejected && request.rejectionReason && (
                                <span
                                  className="max-w-[200px] truncate text-[10px] text-red-400/80"
                                  title={request.rejectionReason}
                                >
                                  Reason: {request.rejectionReason}
                                </span>
                              )}
                              {isGenerated && request.cardId && (
                                <span className="font-mono text-[10px] text-green-400/80">
                                  ID: {request.cardId.substring(0, 10)}...
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      approveMutation.mutate({ requestId: request.id })
                                    }
                                    disabled={approveMutation.isPending}
                                    className="h-7 bg-blue-600/20 text-xs text-blue-400 hover:bg-blue-600/30"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setRejectionRequestId(request.id)}
                                    className="h-7 bg-red-600/20 text-xs text-red-400 hover:bg-red-600/30"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              {isApproved && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    generateCardMutation.mutate({ requestId: request.id })
                                  }
                                  disabled={generateCardMutation.isPending}
                                  className="h-7 bg-green-600/20 text-xs font-semibold text-green-400 hover:bg-green-600/30"
                                >
                                  {generateCardMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="mr-1.5 h-3 w-3" />
                                      Generate Card
                                    </>
                                  )}
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
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Batch Generation</DialogTitle>
            <DialogDescription>
              You are about to generate {approvedCount} lore cards. This process may take several
              minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-yellow-500" />
              <div className="text-sm">
                <p className="text-foreground mb-1 font-medium">Important Notes:</p>
                <ul className="text-muted-foreground list-inside list-disc space-y-1">
                  <li>Duplicate articles will be skipped automatically</li>
                  <li>Failed generations will be logged for review</li>
                  <li>This operation cannot be undone</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateCards}
              className="bg-green-500/20 text-green-500 hover:bg-green-500/30"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate {approvedCount} Cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog
        open={!!rejectionRequestId}
        onOpenChange={(open) => !open && setRejectionRequestId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Lore Card Request</DialogTitle>
            <DialogDescription>
              Please enter the reason for rejecting this request. The user will be fully refunded 50
              IxCredits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Article does not meet quality requirements or is too stub-like."
              maxLength={200}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionRequestId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (rejectionRequestId) {
                  rejectMutation.mutate({
                    requestId: rejectionRequestId,
                    reason: rejectionReason || "Article does not meet requirements",
                  });
                }
              }}
              disabled={rejectMutation.isPending}
              variant="destructive"
            >
              Reject & Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Article Preview Card Component
function ArticlePreviewCard({
  article,
  onToggleApproval,
  disabled,
}: {
  article: ArticlePreview;
  onToggleApproval: () => void;
  disabled: boolean;
}) {
  const rarityColor = RARITY_COLORS[article.estimatedRarity] || RARITY_COLORS.COMMON!;

  return (
    <Card
      className={`glass-card-child p-4 transition-all ${
        article.approved ? "ring-2 ring-green-500" : ""
      } ${article.generated ? "opacity-50" : ""}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <Checkbox
          checked={article.approved}
          onCheckedChange={onToggleApproval}
          disabled={disabled || article.generated}
        />
        <div className="ml-3 flex-1">
          <h3 className="text-foreground mb-1 line-clamp-2 text-sm font-semibold">
            {article.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={rarityColor}>{article.estimatedRarity}</Badge>
            <Badge variant="outline" className="text-xs">
              {article.wikiSource === "ixwiki" ? "IxWiki" : "IIWiki"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-muted-foreground line-clamp-3 text-xs">{article.excerpt}</p>
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Quality Score:</span>
          <div className="flex items-center gap-2">
            <span className="text-foreground font-medium">{article.qualityScore.toFixed(1)}</span>
            <TrendingUp className="h-3 w-3 text-green-400" />
          </div>
        </div>
        <div className="bg-muted/50 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
            style={{ width: `${article.qualityScore}%` }}
          />
        </div>
      </div>

      <div className="border-border border-t pt-3">
        {article.generating && (
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Generating...</span>
          </div>
        )}
        {article.generated && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            <span>Generated successfully</span>
          </div>
        )}
        {article.error && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <XCircle className="h-3 w-3" />
            <span className="line-clamp-1">{article.error}</span>
          </div>
        )}
        {!article.generating && !article.generated && !article.error && (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Clock className="h-3 w-3" />
            <span>{article.approved ? "Ready to generate" : "Pending approval"}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
