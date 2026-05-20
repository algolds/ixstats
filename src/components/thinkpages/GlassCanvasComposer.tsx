"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import {
  Send,
  Image,
  BarChart3,
  TrendingUp,
  Globe,
  Loader2,
  X,
  Plus,
  Sparkles,
  Repeat2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";

// Dynamic import for heavy media search modal
const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then(m => m.MediaSearchModal),
  { ssr: false }
);

interface GlassCanvasComposerProps {
  account: any;
  accounts: any[];
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
  isOwner: boolean;
  onPost: () => void;
  placeholder?: string;
  countryId: string;
  repostData?: {
    originalPost: any;
    mode: "repost";
  };
}

interface DataVisualization {
  id: string;
  type: "economic_chart" | "diplomatic_map" | "trade_flow" | "gdp_growth";
  title: string;
  data: any;
  config: any;
}

export function GlassCanvasComposer({
  account,
  accounts,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  isOwner,
  onPost,
  placeholder = "What's happening in your nation?",
  countryId,
  repostData,
}: GlassCanvasComposerProps) {
  const notify = useNotify();
  const [content, setContent] = useState("");
  const [selectedVisualizations, setSelectedVisualizations] = useState<DataVisualization[]>([]);
  const [showVisualizationPanel, setShowVisualizationPanel] = useState(false);
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const composerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const hasContent = content.trim().length > 0 || selectedImages.length > 0 || selectedVisualizations.length > 0;

  const accountAvatarUrl = account.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(account.displayName || "A")}&background=3B82F6&color=fff&size=128&bold=true`;

  const getAccountAvatar = (acc: any) =>
    acc.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.displayName || "A")}&background=3B82F6&color=fff&size=128&bold=true`;

  // Auto-collapse on scroll down (only if no content is being composed)
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const scrollingDown = currentY > lastScrollY.current && currentY > 100;
      lastScrollY.current = currentY;

      if (scrollingDown && isExpanded && !hasContent) {
        setIsExpanded(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isExpanded, hasContent]);

  // Get latest economic data for visualizations - live wired
  const { data: economicData, isLoading: isLoadingEconomic } =
    api.countries.getEconomicData.useQuery(
      { countryId },
      { enabled: !!countryId, refetchOnWindowFocus: false }
    );
  const { data: gdpHistoryData, isLoading: isLoadingHistory } =
    api.countries.getHistoricalData.useQuery(
      { countryId, limit: 30 },
      { enabled: !!countryId, refetchOnWindowFocus: false }
    );
  const { data: diplomaticData, isLoading: isLoadingDiplomatic } =
    api.diplomatic.getRelationships.useQuery(
      { countryId },
      { enabled: !!countryId, refetchOnWindowFocus: false }
    );
  const { data: tradeData, isLoading: isLoadingTrade } = api.countries.getTradeData.useQuery(
    { countryId },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );

  // Check if we have data available for visualizations
  const hasEconomicData = !!economicData;
  const hasHistoricalData = !!gdpHistoryData && gdpHistoryData.length > 0;
  const hasDiplomaticData = !!diplomaticData && diplomaticData.length > 0;
  const hasTradeData = !!tradeData;

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success("Post shared successfully!");
      setContent("");
      setSelectedVisualizations([]);
      setSelectedImages([]);
      onPost();
    },
    onError: (error) => {
      notify.error(error.message || "Failed to create post");
    },
  });

  const handleSubmit = useCallback(() => {
    if (!content.trim() && selectedVisualizations.length === 0 && selectedImages.length === 0) {
      notify.error("Please add content, a visualization, or an image");
      return;
    }

    // Create post with embedded visualizations and media
    const postData = {
      accountId: account.id,
      content: content.trim(),
      hashtags: extractHashtags(content),
      mentions: extractMentions(content),
      visibility: "public" as const,
      visualizations: selectedVisualizations.map((viz) => ({
        type: viz.type,
        title: viz.title,
        config: viz.config,
      })),
      mediaUrls: selectedImages,
      repostOfId: repostData?.originalPost?.id,
    };

    createPostMutation.mutate(postData);
  }, [content, selectedVisualizations, selectedImages, account.id, createPostMutation, repostData]);

  const extractHashtags = (text: string): string[] => {
    const hashtags = text.match(/#[\w]+/g);
    return hashtags ? hashtags.map((tag) => tag.substring(1)) : [];
  };

  const extractMentions = (text: string): string[] => {
    const mentions = text.match(/@[\w]+/g);
    return mentions ? mentions.map((mention) => mention.substring(1)) : [];
  };

  const addVisualization = (type: DataVisualization["type"]) => {
    // Validate data availability before adding visualization
    let hasRequiredData = false;
    let errorMessage = "";

    switch (type) {
      case "economic_chart":
        hasRequiredData = hasHistoricalData;
        errorMessage = "No historical GDP data available for this country";
        break;
      case "diplomatic_map":
        hasRequiredData = hasDiplomaticData;
        errorMessage = "No diplomatic relationships data available";
        break;
      case "trade_flow":
        hasRequiredData = hasTradeData;
        errorMessage = "No trade data available for this country";
        break;
      case "gdp_growth":
        hasRequiredData = hasEconomicData;
        errorMessage = "No economic data available for this country";
        break;
    }

    if (!hasRequiredData) {
      notify.error(errorMessage);
      return;
    }

    setIsGeneratingVisualization(true);

    // Create visualization based on live data
    setTimeout(() => {
      let newVisualization: DataVisualization;

      switch (type) {
        case "economic_chart":
          newVisualization = {
            id: `econ-${Date.now()}`,
            type: "economic_chart",
            title: "GDP Growth Trajectory",
            data: gdpHistoryData!,
            config: {
              chartType: "line",
              colors: ["#3B82F6", "#10B981"],
              showGrid: true,
              timeRange: "6M",
            },
          };
          break;
        case "diplomatic_map":
          newVisualization = {
            id: `diplo-${Date.now()}`,
            type: "diplomatic_map",
            title: "Diplomatic Relations Map",
            data: diplomaticData!,
            config: {
              mapType: "world",
              showRelationStrength: true,
              colorScheme: "diplomatic",
            },
          };
          break;
        case "trade_flow":
          newVisualization = {
            id: `trade-${Date.now()}`,
            type: "trade_flow",
            title: "Trade Flow Analysis",
            data: tradeData!,
            config: {
              flowType: "sankey",
              showVolumes: true,
              timeframe: "current_quarter",
            },
          };
          break;
        case "gdp_growth":
          newVisualization = {
            id: `gdp-${Date.now()}`,
            type: "gdp_growth",
            title: "Economic Performance Overview",
            data: economicData!,
            config: {
              metrics: ["gdp", "inflation", "unemployment"],
              displayType: "dashboard",
              comparison: "regional_average",
            },
          };
          break;
        default:
          setIsGeneratingVisualization(false);
          return;
      }

      setSelectedVisualizations((prev) => [...prev, newVisualization]);
      setIsGeneratingVisualization(false);
      notify.success(`${newVisualization.title} added to post`);
    }, 800);
  };

  const removeVisualization = (id: string) => {
    setSelectedVisualizations((prev) => prev.filter((viz) => viz.id !== id));
  };

  const handleImageSelect = (imageUrl: string) => {
    if (selectedImages.length >= 4) {
      notify.error("Maximum 4 images per post");
      return;
    }
    setSelectedImages((prev) => [...prev, imageUrl]);
    setShowMediaModal(false);
    notify.success("Image added to post");
  };

  const removeImage = (imageUrl: string) => {
    setSelectedImages((prev) => prev.filter((url) => url !== imageUrl));
  };

  const handleFileUpload = async (file: File) => {
    if (selectedImages.length >= 4) {
      notify.error("Maximum 4 images per post");
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(withBasePath("/api/upload/image"), {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setSelectedImages((prev) => [...prev, result.url]);
        notify.success("Image uploaded successfully");
      } else {
        notify.error(result.error || "Failed to upload image");
      }
    } catch (error) {
      console.error("Upload error:", error);
      notify.error("Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const getVisualizationPreview = (viz: DataVisualization) => {
    switch (viz.type) {
      case "economic_chart":
        return (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gradient-to-r from-blue-500/20 to-green-500/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-400" />
              <div className="text-sm">
                <div className="font-medium">
                  GDP: +{(((economicData as any)?.adjustedGdpGrowth || 0.03) * 100).toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-xs">Q4 Performance</div>
              </div>
            </div>
          </div>
        );
      case "diplomatic_map":
        return (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gradient-to-r from-blue-500/20 to-purple-500/20">
            <div className="flex items-center gap-2">
              <Globe className="h-6 w-6 text-blue-400" />
              <div className="text-sm">
                <div className="font-medium">{diplomaticData?.length || 12} Relations</div>
                <div className="text-muted-foreground text-xs">Global Network</div>
              </div>
            </div>
          </div>
        );
      case "trade_flow":
        return (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gradient-to-r from-purple-500/20 to-orange-500/20">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-purple-400" />
              <div className="text-sm">
                <div className="font-medium">
                  ${((tradeData?.totalVolume || 2.4) / 1000).toFixed(1)}B
                </div>
                <div className="text-muted-foreground text-xs">Trade Volume</div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gradient-to-r from-gray-500/20 to-gray-400/20">
            <BarChart3 className="h-6 w-6 text-gray-400" />
          </div>
        );
    }
  };

  const characterLimit = 280;
  const remainingChars = characterLimit - content.length;

  return (
    <Card ref={composerRef} className="glass-hierarchy-child border-blue-500/30 bg-blue-500/5">
      {/* ── Collapsed bar ── */}
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <button
              onClick={() => setIsExpanded(true)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={accountAvatarUrl} alt={account.displayName} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-semibold text-white">
                  {account.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground flex-1 text-xs">{placeholder}</span>
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <CardContent className="p-3">
              <div className="space-y-3">
                {/* Account Info with Manager */}
                <Collapsible open={showAccountManager} onOpenChange={setShowAccountManager}>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={accountAvatarUrl} alt={account.displayName} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-semibold text-white">
                        {account.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium leading-tight">{account.displayName}</div>
                      <div className="text-muted-foreground text-[0.65rem]">@{account.username}</div>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        {showAccountManager ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-7 w-7 p-0"
                      onClick={() => setIsExpanded(false)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <CollapsibleContent className="mt-2.5">
                    <div className="border-t border-white/10 pt-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-medium">Switch Account</h4>
                        {isOwner && accounts.length < 25 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={onCreateAccount}
                            className="h-6 text-[0.65rem]"
                          >
                            <Plus className="mr-1 h-2.5 w-2.5" />
                            New
                          </Button>
                        )}
                      </div>

                      <div className="grid max-h-32 gap-1.5 overflow-y-auto">
                        {accounts.map((acc) => (
                          <div
                            key={acc.id}
                            onClick={() => {
                              onAccountSelect?.(acc);
                              setShowAccountManager(false);
                            }}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg p-1.5 transition-colors",
                              acc.id === account.id
                                ? "border border-blue-500/30 bg-blue-500/20"
                                : "border border-transparent hover:bg-white/10"
                            )}
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={getAccountAvatar(acc)} />
                              <AvatarFallback className="text-[0.6rem]">
                                {acc.displayName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[0.65rem] font-medium">{acc.displayName}</div>
                            </div>
                            <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px]">
                              {acc.accountType}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Embedded Repost Display */}
                {repostData && (
                  <Card className="border-green-500/30 bg-green-500/5 p-2.5">
                    <div className="mb-1.5 flex items-center gap-2 text-xs text-green-500">
                      <Repeat2 className="h-3 w-3" />
                      <span>Reposting</span>
                    </div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage
                          src={repostData.originalPost.account?.profileImageUrl}
                          alt={repostData.originalPost.account?.displayName}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-[0.6rem] font-semibold text-white">
                          {repostData.originalPost.account?.displayName?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold">
                        {repostData.originalPost.account?.displayName || "Unknown"}
                      </span>
                      <span className="text-muted-foreground text-[0.65rem]">
                        @{repostData.originalPost.account?.username || "unknown"}
                      </span>
                    </div>
                    <div className="text-muted-foreground line-clamp-2 text-xs">
                      {repostData.originalPost.content}
                    </div>
                  </Card>
                )}

                {/* Text Composer */}
                <div className="space-y-1.5">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={placeholder}
                    className="min-h-16 resize-none border-0 bg-white/5 text-sm backdrop-blur-sm transition-all focus:bg-white/10"
                    maxLength={characterLimit}
                  />
                  <div className="flex items-center justify-between text-[0.65rem]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Live data</span>
                      {(hasEconomicData || hasHistoricalData || hasDiplomaticData || hasTradeData) && (
                        <Badge
                          variant="outline"
                          className="h-3.5 border-green-500/30 bg-green-500/10 px-1 py-0 text-[9px] text-green-400"
                        >
                          Live
                        </Badge>
                      )}
                    </div>
                    <span
                      className={cn(
                        "font-medium",
                        remainingChars < 20
                          ? "text-red-400"
                          : remainingChars < 50
                            ? "text-orange-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {remainingChars}
                    </span>
                  </div>
                </div>

                {/* Selected Images */}
                <AnimatePresence>
                  {selectedImages.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-2 gap-2"
                    >
                      {selectedImages.map((imageUrl, index) => (
                        <motion.div
                          key={imageUrl}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-white/5"
                        >
                          <button
                            onClick={() => removeImage(imageUrl)}
                            className="absolute top-1.5 right-1.5 z-10 rounded-full bg-black/60 p-0.5 transition-colors hover:bg-red-500/80"
                          >
                            <X className="h-3.5 w-3.5 text-white" />
                          </button>
                          <img
                            src={imageUrl}
                            alt={`Selected image ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected Visualizations */}
                <AnimatePresence>
                  {selectedVisualizations.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5"
                    >
                      {selectedVisualizations.map((viz) => (
                        <motion.div
                          key={viz.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative rounded-lg border border-white/10 bg-white/5 p-2.5"
                        >
                          <button
                            onClick={() => removeVisualization(viz.id)}
                            className="absolute top-1.5 right-1.5 rounded-full p-0.5 transition-colors hover:bg-red-500/20"
                          >
                            <X className="h-3.5 w-3.5 text-red-400" />
                          </button>
                          <div className="space-y-1.5">
                            <div className="text-xs font-medium">{viz.title}</div>
                            {getVisualizationPreview(viz)}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Visualization Panel */}
                <AnimatePresence>
                  {showVisualizationPanel && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-lg border border-white/10 bg-white/5 p-2.5"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-xs font-medium">Add Live Data</span>
                        </div>
                        {(isLoadingEconomic ||
                          isLoadingHistory ||
                          isLoadingDiplomatic ||
                          isLoadingTrade) && (
                          <div className="flex items-center gap-1 text-[0.65rem] text-blue-400">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            <span>Loading...</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVisualization("economic_chart")}
                          disabled={isGeneratingVisualization || isLoadingHistory || !hasHistoricalData}
                          className="h-auto flex-col p-2"
                        >
                          {isLoadingHistory ? (
                            <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
                          ) : (
                            <TrendingUp className="mb-0.5 h-5 w-5" />
                          )}
                          <span className="text-[0.65rem]">Economic</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVisualization("diplomatic_map")}
                          disabled={
                            isGeneratingVisualization || isLoadingDiplomatic || !hasDiplomaticData
                          }
                          className="h-auto flex-col p-2"
                        >
                          {isLoadingDiplomatic ? (
                            <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
                          ) : (
                            <Globe className="mb-0.5 h-5 w-5" />
                          )}
                          <span className="text-[0.65rem]">Diplomatic</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVisualization("trade_flow")}
                          disabled={isGeneratingVisualization || isLoadingTrade || !hasTradeData}
                          className="h-auto flex-col p-2"
                        >
                          {isLoadingTrade ? (
                            <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
                          ) : (
                            <BarChart3 className="mb-0.5 h-5 w-5" />
                          )}
                          <span className="text-[0.65rem]">Trade</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVisualization("gdp_growth")}
                          disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
                          className="h-auto flex-col p-2"
                        >
                          {isLoadingEconomic ? (
                            <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
                          ) : (
                            <BarChart3 className="mb-0.5 h-5 w-5" />
                          )}
                          <span className="text-[0.65rem]">GDP</span>
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowVisualizationPanel(!showVisualizationPanel)}
                      className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300"
                    >
                      {isGeneratingVisualization ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="mr-1 h-3.5 w-3.5" />
                      )}
                      Data
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMediaModal(true)}
                      disabled={isUploadingImage || selectedImages.length >= 4}
                      className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Image className="mr-1 h-3.5 w-3.5" />
                      )}
                      Media
                      {selectedImages.length > 0 && (
                        <Badge variant="outline" className="ml-1 h-3.5 px-1 py-0 text-[9px]">
                          {selectedImages.length}/4
                        </Badge>
                      )}
                    </Button>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    size="sm"
                    disabled={
                      createPostMutation.isPending ||
                      (!content.trim() &&
                        selectedVisualizations.length === 0 &&
                        selectedImages.length === 0)
                    }
                    className="h-7 bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                  >
                    {createPostMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Share
                  </Button>
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Search Modal */}
      <MediaSearchModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onImageSelect={handleImageSelect}
      />
    </Card>
  );
}
