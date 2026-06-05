// @ts-nocheck
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
  Users,
  Briefcase,
  Activity,
  Minus,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent } from "~/components/ui/card";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Badge } from "~/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";
import { EmojiPicker } from "./EmojiPicker";
import { GifPicker } from "./GifPicker";

// Dynamic import for heavy media search modal
const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
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
  type:
    | "economic_chart"
    | "diplomatic_map"
    | "trade_flow"
    | "gdp_growth"
    | "demographics"
    | "budget_debt"
    | "labor_market"
    | "national_vitality";
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
  placeholder = "What's happening?",
  countryId,
  repostData,
}: GlassCanvasComposerProps) {
  const notify = useNotify();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [selectedVisualizations, setSelectedVisualizations] = useState<DataVisualization[]>([]);
  const [showVisualizationPanel, setShowVisualizationPanel] = useState(false);
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [postToDiscord, setPostToDiscord] = useState(true);

  const handleInsertEmoji = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + emoji);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newContent = before + emoji + after;
    setContent(newContent);

    const newCursorPos = start + emoji.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, []);

  const handleInsertGif = useCallback(
    (gifUrl: string) => {
      if (selectedImages.length >= 4) {
        notify.error("Maximum 4 images/GIFs per post");
        return;
      }
      setSelectedImages((prev) => [...prev, gifUrl]);
      notify.success("GIF added to post");
    },
    [selectedImages, notify]
  );
  const composerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const hasContent =
    content.trim().length > 0 || selectedImages.length > 0 || selectedVisualizations.length > 0;

  const accountAvatarUrl =
    account.profileImageUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(account.displayName || "A")}&background=3B82F6&color=fff&size=128&bold=true`;

  const getAccountAvatar = (acc: any) =>
    acc.profileImageUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.displayName || "A")}&background=3B82F6&color=fff&size=128&bold=true`;

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
    api.countries.getByIdWithEconomicData.useQuery(
      { id: countryId },
      { enabled: !!countryId, refetchOnWindowFocus: false }
    );
  const { data: gdpHistoryData, isLoading: isLoadingHistory } =
    api.historical.getCountryHistory.useQuery(
      { countryId, limit: 30 },
      { enabled: !!countryId, refetchOnWindowFocus: false }
    );
  const { data: diplomaticData, isLoading: isLoadingDiplomatic } =
    api.diplomaticCore.getRelationships.useQuery(
      { countryId },
      { enabled: !!countryId, refetchOnWindowFocus: false }
    );
  const { data: tradeData, isLoading: isLoadingTrade } = api.countries.getTradeData.useQuery(
    { countryId },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );
  const { data: vitalityData, isLoading: isLoadingVitality } =
    api.countries.getActivityRingsData.useQuery(
      { countryId },
      { enabled: !!countryId, refetchOnWindowFocus: false }
    );

  // Check if we have data available for visualizations
  const hasEconomicData = !!economicData;
  const hasHistoricalData =
    !!gdpHistoryData &&
    (gdpHistoryData.length > 0 ||
      (economicData &&
        (economicData as any).historical &&
        (economicData as any).historical.length > 0));
  const hasDiplomaticData = !!diplomaticData && diplomaticData.length > 0;
  const hasTradeData = !!tradeData;
  const hasVitalityData = !!vitalityData;

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success("Post shared successfully!");
      setContent("");
      setSelectedVisualizations([]);
      setSelectedImages([]);
      setPostToDiscord(true);
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
      postToDiscord,
    };

    createPostMutation.mutate(postData);
  }, [
    content,
    selectedVisualizations,
    selectedImages,
    account.id,
    createPostMutation,
    repostData,
    postToDiscord,
  ]);

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
      case "demographics":
        hasRequiredData = hasEconomicData;
        errorMessage = "No demographics data available for this country";
        break;
      case "budget_debt":
        hasRequiredData = hasEconomicData;
        errorMessage = "No fiscal budget/debt data available for this country";
        break;
      case "labor_market":
        hasRequiredData = hasEconomicData;
        errorMessage = "No labor market data available for this country";
        break;
      case "national_vitality":
        hasRequiredData = hasVitalityData;
        errorMessage = "No activity/vitality data available for this country";
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
            data:
              gdpHistoryData && gdpHistoryData.length > 0
                ? gdpHistoryData
                : (economicData as any)?.historical?.map((h: any) => ({
                    ixTimeTimestamp: new Date(h.year, 0, 1),
                    totalGdp: h.gdp,
                    population: h.population,
                  })) || [],
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
        case "demographics":
          newVisualization = {
            id: `demo-${Date.now()}`,
            type: "demographics",
            title: "Demographics Profile",
            data: {
              lifeExpectancy: economicData.lifeExpectancy,
              literacyRate: economicData.literacyRate,
              urbanPopulationPercent: economicData.urbanPopulationPercent,
              ruralPopulationPercent: economicData.ruralPopulationPercent,
              population: economicData.currentPopulation || economicData.population,
            },
            config: {
              displayType: "stats_grid",
              colorScheme: "green",
            },
          };
          break;
        case "budget_debt":
          newVisualization = {
            id: `fiscal-${Date.now()}`,
            type: "budget_debt",
            title: "Fiscal & Debt Analysis",
            data: {
              taxRevenueGDPPercent: economicData.taxRevenueGDPPercent,
              governmentBudgetGDPPercent: economicData.governmentBudgetGDPPercent,
              totalGovernmentSpending: economicData.totalGovernmentSpending,
              totalDebtGDPRatio: economicData.totalDebtGDPRatio,
              budgetDeficitSurplus: economicData.budgetDeficitSurplus,
            },
            config: {
              displayType: "donut",
              colorScheme: "amber",
            },
          };
          break;
        case "labor_market":
          newVisualization = {
            id: `labor-${Date.now()}`,
            type: "labor_market",
            title: "Labor & Income Profile",
            data: {
              unemploymentRate: economicData.unemploymentRate,
              incomeInequalityGini: economicData.incomeInequalityGini,
              averageAnnualIncome: economicData.averageAnnualIncome,
              minimumWage: economicData.minimumWage,
            },
            config: {
              metrics: ["unemployment", "gini", "income"],
              displayType: "stats_grid",
              colorScheme: "teal",
            },
          };
          break;
        case "national_vitality":
          newVisualization = {
            id: `vitality-${Date.now()}`,
            type: "national_vitality",
            title: "National Vitality Assessment",
            data: vitalityData!,
            config: {
              metrics: ["economic", "population", "diplomatic", "government"],
              displayType: "progress_bars",
              colorScheme: "red",
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
                  GDP: +
                  {(((economicData as any)?.calculatedStats?.gdpGrowth || 0.03) * 100).toFixed(1)}%
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
      case "gdp_growth":
        return (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gradient-to-r from-blue-500/20 to-emerald-500/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
              <div className="text-sm">
                <div className="font-medium">GDP Stats</div>
                <div className="text-muted-foreground text-xs">Economic Performance</div>
              </div>
            </div>
          </div>
        );
      case "demographics":
        return (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gradient-to-r from-green-500/20 to-teal-500/20">
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-green-400" />
              <div className="text-sm">
                <div className="font-medium">
                  Life Exp: {economicData?.lifeExpectancy || 75} yrs
                </div>
                <div className="text-muted-foreground text-xs">
                  Literacy: {economicData?.literacyRate || 99}%
                </div>
              </div>
            </div>
          </div>
        );
      case "budget_debt":
        return (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gradient-to-r from-amber-500/20 to-red-500/20">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-amber-400" />
              <div className="text-sm">
                <div className="font-medium">
                  Debt/GDP: {economicData?.totalDebtGDPRatio || 45}%
                </div>
                <div className="text-muted-foreground text-xs">
                  Tax Rev: {economicData?.taxRevenueGDPPercent || 25}% of GDP
                </div>
              </div>
            </div>
          </div>
        );
      case "labor_market":
        return (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gradient-to-r from-teal-500/20 to-blue-500/20">
            <div className="flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-teal-400" />
              <div className="text-sm">
                <div className="font-medium">
                  Unemployment: {economicData?.unemploymentRate || 5.2}%
                </div>
                <div className="text-muted-foreground text-xs">
                  Gini Index: {economicData?.incomeInequalityGini || 32}
                </div>
              </div>
            </div>
          </div>
        );
      case "national_vitality":
        return (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gradient-to-r from-red-500/20 to-purple-500/20">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-red-400" />
              <div className="text-sm">
                <div className="font-medium">Vitality: {vitalityData?.economicVitality || 75}%</div>
                <div className="text-muted-foreground text-xs">
                  Wellbeing: {vitalityData?.populationWellbeing || 70}%
                </div>
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
    <Card
      ref={composerRef}
      className="glass-hierarchy-child relative gap-0 overflow-hidden border-blue-500/30 bg-blue-500/5 py-0"
    >
      <TextureOverlay texture="paperGrain" opacity={0.06} />
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
              <div className="space-y-2">
                {/* Account Info with Manager */}
                <Collapsible open={showAccountManager} onOpenChange={setShowAccountManager}>
                  <div className="flex items-center gap-2.5">
                    <CollapsibleTrigger asChild>
                      <div className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-white/5">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={accountAvatarUrl} alt={account.displayName} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-semibold text-white">
                            {account.displayName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs leading-tight font-medium">
                            {account.displayName}
                          </div>
                          <div className="text-muted-foreground text-[0.65rem]">
                            @{account.username}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="pointer-events-none h-7 w-7 p-0"
                        >
                          {showAccountManager ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
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
                              <div className="truncate text-[0.65rem] font-medium">
                                {acc.displayName}
                              </div>
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
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={placeholder}
                    className="min-h-16 resize-none border-0 bg-white/5 text-sm backdrop-blur-sm transition-all focus:bg-white/10"
                    maxLength={characterLimit}
                  />
                  <div className="flex justify-end text-[0.65rem]">
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
                      {remainingChars} characters remaining
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
                          isLoadingTrade ||
                          isLoadingVitality) && (
                          <div className="flex items-center gap-1 text-[0.65rem] text-blue-400">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            <span>Loading...</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVisualization("economic_chart")}
                          disabled={
                            isGeneratingVisualization || isLoadingHistory || !hasHistoricalData
                          }
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
                          disabled={
                            isGeneratingVisualization || isLoadingEconomic || !hasEconomicData
                          }
                          className="h-auto flex-col p-2"
                        >
                          {isLoadingEconomic ? (
                            <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
                          ) : (
                            <BarChart3 className="mb-0.5 h-5 w-5" />
                          )}
                          <span className="text-[0.65rem]">GDP</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVisualization("demographics")}
                          disabled={
                            isGeneratingVisualization || isLoadingEconomic || !hasEconomicData
                          }
                          className="h-auto flex-col p-2"
                        >
                          {isLoadingEconomic ? (
                            <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
                          ) : (
                            <Users className="mb-0.5 h-5 w-5" />
                          )}
                          <span className="text-[0.65rem]">Demographics</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVisualization("budget_debt")}
                          disabled={
                            isGeneratingVisualization || isLoadingEconomic || !hasEconomicData
                          }
                          className="h-auto flex-col p-2"
                        >
                          {isLoadingEconomic ? (
                            <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
                          ) : (
                            <BarChart3 className="mb-0.5 h-5 w-5" />
                          )}
                          <span className="text-[0.65rem]">Budget & Debt</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVisualization("labor_market")}
                          disabled={
                            isGeneratingVisualization || isLoadingEconomic || !hasEconomicData
                          }
                          className="h-auto flex-col p-2"
                        >
                          {isLoadingEconomic ? (
                            <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
                          ) : (
                            <Briefcase className="mb-0.5 h-5 w-5" />
                          )}
                          <span className="text-[0.65rem]">Labor Market</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addVisualization("national_vitality")}
                          disabled={
                            isGeneratingVisualization || isLoadingVitality || !hasVitalityData
                          }
                          className="h-auto flex-col p-2"
                        >
                          {isLoadingVitality ? (
                            <Loader2 className="mb-0.5 h-5 w-5 animate-spin" />
                          ) : (
                            <Activity className="mb-0.5 h-5 w-5" />
                          )}
                          <span className="text-[0.65rem]">Vitality Rings</span>
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowVisualizationPanel(!showVisualizationPanel)}
                      className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300"
                    >
                      {isGeneratingVisualization ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <motion.div
                          animate={{ rotate: showVisualizationPanel ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="mr-1"
                        >
                          {showVisualizationPanel ? (
                            <Minus className="h-3.5 w-3.5" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                        </motion.div>
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
                    <EmojiPicker onSelectEmoji={handleInsertEmoji} />
                    <GifPicker
                      onSelectGif={handleInsertGif}
                      disabled={selectedImages.length >= 4}
                    />
                    <div className="flex h-5 items-center gap-2 border-l border-white/10 px-2">
                      <Switch
                        id="share-to-discord-toggle"
                        checked={postToDiscord}
                        onCheckedChange={setPostToDiscord}
                        className="border-white/10 data-[state=checked]:bg-[#5865F2] data-[state=checked]:shadow-[0_0_8px_rgba(88,101,242,0.4)] data-[state=unchecked]:bg-white/10 dark:data-[state=unchecked]:bg-white/10"
                      />
                      <label
                        htmlFor="share-to-discord-toggle"
                        className="flex cursor-pointer items-center gap-1.5 text-[10px] text-neutral-400 transition-colors select-none hover:text-neutral-300"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className={cn(
                            "h-3 w-3 fill-current transition-colors duration-200",
                            postToDiscord ? "text-[#5865F2]" : "text-neutral-500"
                          )}
                        >
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
                        </svg>
                        Share to Discord
                      </label>
                    </div>
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
