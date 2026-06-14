// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronUp,
  Users,
  Briefcase,
  Activity,
  Minus,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Landmark,
  Newspaper,
  Vote,
  Info,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Textarea } from "~/components/ui/textarea";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Card, CardContent } from "~/components/ui/card";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Badge } from "~/components/ui/badge";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";
import { GifPicker } from "./GifPicker";
import { LiveDataCard } from "./LiveDataCard";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
// eslint-disable-next-line unused-imports/no-unused-imports
import Link from "next/link";
import { GlassPlateEditor } from "./GlassPlateEditor";

// Dynamic import for heavy media search modal
const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

interface GlassCanvasComposerProps {
  account: any | null;
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
  isSignedIn?: boolean;
  hasCountry?: boolean;
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
  // eslint-disable-next-line unused-imports/no-unused-vars
  onAccountSettings,
  onCreateAccount,
  isOwner,
  onPost,
  placeholder = "What's happening?",
  countryId,
  repostData,
  // eslint-disable-next-line unused-imports/no-unused-vars
  isSignedIn = true,
  hasCountry = true,
}: GlassCanvasComposerProps) {
  const notify = useNotify();
  const isRegularUser = !isOwner && account?.accountType === "citizen";
  const { data: channelTopic } = api.thinkpages.getDiscordChannelTopic.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const [showDiscordTopic, setShowDiscordTopic] = useState(false);
  const editorRef = useRef<any>(null);
  const [content, setContent] = useState("");
  const [plainText, setPlainText] = useState("");
  const [selectedVisualizations, setSelectedVisualizations] = useState<DataVisualization[]>([]);
  const [showVisualizationPanel, setShowVisualizationPanel] = useState(false);
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [postToDiscord, setPostToDiscord] = useState(true);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [pollDraft, setPollDraft] = useState<{
    question: string;
    pollType: "choice" | "feature-poll";
    multiple: boolean;
    options: string[];
  } | null>(null);
  const [showPollModal, setShowPollModal] = useState(false);

  useEffect(() => {
    if (channelTopic) {
      const isDev = process.env.NODE_ENV === "development";
      const shouldShow = isDev || Math.random() < 0.1;
      if (shouldShow) {
        setShowDiscordTopic(true);
      }
    }
  }, [channelTopic]);

  const resolvedPlaceholder = showDiscordTopic && !isEditorFocused ? channelTopic : placeholder;

  const accountAvatarUrl = account
    ? account.profileImageUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(account.displayName || "A")}&background=3B82F6&color=fff&size=128&bold=true`
    : "";

  const getAccountAvatar = (acc: any) =>
    acc.profileImageUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.displayName || "A")}&background=3B82F6&color=fff&size=128&bold=true`;

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
  const hasContent =
    plainText.trim().length > 0 || selectedImages.length > 0 || selectedVisualizations.length > 0;

  const showActionBar = isEditorFocused || hasContent || showVisualizationPanel;

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

  const utils = api.useUtils();

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      notify.success("Post shared successfully!");
      setContent("");
      setPlainText("");
      if (editorRef.current) {
        editorRef.current.clear();
      }
      setSelectedVisualizations([]);
      setSelectedImages([]);
      setPollDraft(null);
      setPostToDiscord(true);
      void utils.thinkpages.getFeed.invalidate();
      if (account?.clerkUserId) {
        void utils.thinkpages.getPostsByClerkUserId.invalidate({
          clerkUserId: account.clerkUserId,
        });
      }
      onPost();
    },
    onError: (error) => {
      notify.error(error.message || "Failed to create post");
    },
  });

  const handleSubmit = useCallback(() => {
    if (!account) return;

    if (
      !plainText.trim() &&
      selectedVisualizations.length === 0 &&
      selectedImages.length === 0 &&
      !pollDraft
    ) {
      notify.error("Please add content, a visualization, an image, or a poll");
      return;
    }

    if (pollDraft) {
      if (!pollDraft.question.trim()) {
        notify.error("Please enter a poll question");
        return;
      }
      const validOpts = pollDraft.options.map((opt) => opt.trim()).filter((opt) => opt.length > 0);
      if (validOpts.length < 2) {
        notify.error("A poll must have at least 2 options");
        return;
      }
    }

    // Create post with embedded visualizations and media
    const postData = {
      accountId: account.id,
      content: content.trim(),
      hashtags: extractHashtags(plainText),
      mentions: extractMentions(plainText),
      visibility: "public" as const,
      visualizations: selectedVisualizations.map((viz) => ({
        type: viz.type,
        title: viz.title,
        config: viz.config,
      })),
      mediaUrls: selectedImages,
      repostOfId: repostData?.originalPost?.id,
      postToDiscord,
      poll: pollDraft
        ? {
            question: pollDraft.question.trim(),
            pollType: pollDraft.pollType,
            multiple: pollDraft.multiple,
            options: pollDraft.options.map((opt) => opt.trim()).filter((opt) => opt.length > 0),
          }
        : undefined,
    };

    createPostMutation.mutate(postData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    content,
    plainText,
    selectedVisualizations,
    selectedImages,
    account?.id,
    createPostMutation,
    repostData,
    postToDiscord,
    pollDraft,
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

  // eslint-disable-next-line unused-imports/no-unused-vars
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
    return (
      <LiveDataCard
        type={viz.type}
        title={viz.title}
        countryId={countryId}
        preloadedData={{
          economicData,
          gdpHistoryData,
          diplomaticData,
          tradeData,
          vitalityData,
        }}
      />
    );
  };

  const characterLimit = 280;
  const remainingChars = characterLimit - plainText.length;

  // Conditional render for account required notice inline
  if (accounts.length === 0) {
    return (
      <Card className="glass-hierarchy-child relative gap-0 overflow-hidden border-[#ff8a65]/35 bg-[#ff8a65]/5 p-5">
        <TextureOverlay texture="paperGrain" opacity={0.06} />
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ff8a65]/20 bg-[#ff8a65]/15">
              <Newspaper className="h-5 w-5 text-[#ff8a65]" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-foreground text-xs font-semibold">
                Create a ThinkPages Account to post
              </h4>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-normal">
                Set up a ThinkPages Account to publish articles and participate in global community
                discussions.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onCreateAccount}
            className="h-8 shrink-0 cursor-pointer border-0 bg-[#ff8a65] text-xs text-white hover:bg-[#ff8a65]/90"
          >
            Create Account
          </Button>
        </div>
      </Card>
    );
  }

  // Conditional render for loading/skeleton state or missing country configuration
  if (!hasCountry || !account) {
    return (
      <Card className="glass-hierarchy-child relative animate-pulse gap-0 overflow-hidden border-blue-500/10 bg-blue-500/5 p-4">
        <TextureOverlay texture="paperGrain" opacity={0.06} />
        <div className="mb-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-white/10" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="h-2 w-16 rounded bg-white/5" />
          </div>
        </div>
        <div className="mb-3 h-16 w-full rounded-lg bg-white/5" />
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <div className="h-7 w-7 rounded bg-white/5" />
            <div className="h-7 w-7 rounded bg-white/5" />
            <div className="h-7 w-7 rounded bg-white/5" />
          </div>
          <div className="h-7 w-16 rounded bg-white/10" />
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      layout
      ref={composerRef}
      className={cn(
        "bg-card text-card-foreground glass-hierarchy-child relative flex flex-col gap-0 rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 shadow-sm"
      )}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 35,
      }}
    >
      <TextureOverlay texture="paperGrain" opacity={0.06} className="rounded-xl" />

      <div className="relative flex gap-3">
        {/* Left column: Avatar + Floating Switcher */}
        <div className="relative flex shrink-0 flex-col items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowAccountManager(!showAccountManager)}
                className="group relative cursor-pointer focus:outline-none"
              >
                <Avatar className="border-border/50 h-9 w-9 border shadow-sm transition-all duration-200 group-hover:scale-105 active:scale-95">
                  <AvatarImage src={accountAvatarUrl} alt={account.displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
                    {account.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                {/* Floating Chevron Down Badge */}
                <div className="bg-popover border-border text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border shadow-md transition-colors">
                  <ChevronDown className="h-2.5 w-2.5" />
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Switch account</TooltipContent>
          </Tooltip>

          {/* Floating Account Switcher Dropdown (macOS Glass style) */}
          <AnimatePresence>
            {showAccountManager && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 5 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="border-border/50 bg-popover/95 text-popover-foreground absolute top-11 left-0 z-50 w-64 rounded-2xl border p-2 shadow-2xl backdrop-blur-xl"
              >
                <div className="border-border mb-2 flex items-center justify-between border-b px-2 py-1 pb-2">
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Switch Account
                  </span>
                  {isOwner && accounts.length < 25 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onCreateAccount?.();
                        setShowAccountManager(false);
                      }}
                      className="hover:bg-accent h-5 px-1.5 text-[9px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Plus className="mr-0.5 h-2.5 w-2.5" />
                      Add Account
                    </Button>
                  )}
                </div>

                <div className="thin-scrollbar grid max-h-48 gap-1 overflow-y-auto">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        onAccountSelect?.(acc);
                        setShowAccountManager(false);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border p-2 text-left transition-all duration-200",
                        acc.id === account.id
                          ? "border-blue-500/30 bg-blue-500/10 font-semibold text-blue-600 dark:text-blue-400"
                          : "hover:bg-accent text-foreground border-transparent"
                      )}
                    >
                      <Avatar className="border-border h-7 w-7 border">
                        <AvatarImage src={getAccountAvatar(acc)} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-[0.6rem]">
                          {acc.displayName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs leading-tight font-semibold">
                          {acc.displayName}
                        </div>
                        <div className="text-muted-foreground mt-0.5 truncate text-[10px]">
                          @{acc.username}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-border text-muted-foreground h-4 px-1 py-0 text-[8px] leading-none"
                      >
                        {acc.accountType}
                      </Badge>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: Editor + Previews + Actions */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {repostData && (
            <Card className="mb-1 border-green-500/30 bg-green-500/5 p-2.5">
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

          <div className="space-y-1.5">
            <GlassPlateEditor
              ref={editorRef}
              value={content}
              onChange={(htmlContent, rawText) => {
                setContent(htmlContent);
                setPlainText(rawText);
              }}
              placeholder={resolvedPlaceholder}
              italicPlaceholder={resolvedPlaceholder !== placeholder}
              onFocus={() => setIsEditorFocused(true)}
              onBlur={() => setIsEditorFocused(false)}
            />
          </div>

          {selectedImages.length > 0 && (
            <div className="mt-1 grid grid-cols-2 gap-2">
              {selectedImages.map((imageUrl, index) => (
                <div
                  key={imageUrl}
                  className="relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-500/5 dark:border-white/10 dark:bg-white/5"
                >
                  <button
                    onClick={() => removeImage(imageUrl)}
                    className="absolute top-1.5 right-1.5 z-10 cursor-pointer rounded-full bg-black/60 p-0.5 transition-colors hover:bg-red-500/80"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                  <img
                    src={imageUrl}
                    alt={`Selected image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {selectedVisualizations.length > 0 && (
            <div className="mt-1 space-y-1.5">
              {selectedVisualizations.map((viz) => (
                <div
                  key={viz.id}
                  className="relative rounded-lg border border-slate-200 bg-slate-500/5 p-2.5 dark:border-white/10 dark:bg-white/5"
                >
                  <button
                    onClick={() => removeVisualization(viz.id)}
                    className="absolute top-1.5 right-1.5 cursor-pointer rounded-full p-0.5 transition-colors hover:bg-red-500/20"
                  >
                    <X className="h-3.5 w-3.5 text-red-400" />
                  </button>
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium">{viz.title}</div>
                    {getVisualizationPreview(viz)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pollDraft && (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mt-1.5 flex items-center justify-between rounded-xl border border-[#ff8a65]/20 bg-[#ff8a65]/5 p-3.5"
            >
              <div className="flex items-center gap-2">
                <Vote className="h-4 w-4 shrink-0 text-[#ff8a65]" />
                <div className="min-w-0">
                  <p className="text-foreground truncate text-xs font-semibold">
                    {pollDraft.question || "Untitled Poll"}
                  </p>
                  <p className="text-muted-foreground text-[10px]">
                    {pollDraft.pollType === "choice" ? "Choice Poll" : "Feature Poll"} •{" "}
                    {pollDraft.options.filter((o) => o.trim()).length} options
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPollModal(true)}
                  className="h-7 cursor-pointer border-[#ff8a65]/30 px-2.5 text-[10px] font-semibold text-[#ff8a65] hover:bg-[#ff8a65]/10 dark:text-[#ff8a65]"
                >
                  Edit Poll
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPollDraft(null)}
                  className="h-7 w-7 cursor-pointer text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}

          <motion.div
            layout
            initial={false}
            animate={{
              height: showVisualizationPanel ? "auto" : 0,
              opacity: showVisualizationPanel ? 1 : 0,
              marginTop: showVisualizationPanel ? 10 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 35,
            }}
            className={cn("overflow-hidden", !showVisualizationPanel && "pointer-events-none")}
          >
            <div className="rounded-lg border border-slate-200 bg-slate-500/5 p-2.5 dark:border-white/10 dark:bg-white/5">
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
                  disabled={isGeneratingVisualization || isLoadingDiplomatic || !hasDiplomaticData}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addVisualization("demographics")}
                  disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
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
                  disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
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
                  disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
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
                  disabled={isGeneratingVisualization || isLoadingVitality || !hasVitalityData}
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
            </div>
          </motion.div>

          <motion.div
            layout
            initial={false}
            animate={{
              height: showActionBar ? "auto" : 0,
              opacity: showActionBar ? 1 : 0,
              marginTop: showActionBar ? 10 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 35,
            }}
            className={cn("overflow-hidden", !showActionBar && "pointer-events-none")}
          >
            <div className="space-y-2 pt-1">
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowVisualizationPanel(!showVisualizationPanel)}
                        className={cn(
                          "h-8 w-8 cursor-pointer p-0 text-blue-600 transition-colors hover:bg-slate-500/5 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-white/5 dark:hover:text-blue-300",
                          showVisualizationPanel && "bg-slate-500/10 dark:bg-white/10"
                        )}
                      >
                        {isGeneratingVisualization ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <BarChart3 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Add live data chart</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMediaModal(true)}
                        disabled={isUploadingImage || selectedImages.length >= 4}
                        className="h-8 w-8 cursor-pointer p-0 text-emerald-600 transition-colors hover:bg-slate-500/5 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-white/5 dark:hover:text-emerald-300"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <div className="relative">
                            <Image className="h-4 w-4" />
                            {selectedImages.length > 0 && (
                              <Badge
                                variant="secondary"
                                className="border-background absolute -top-2 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border bg-green-500 p-0 text-[7px] leading-none font-bold text-white"
                              >
                                {selectedImages.length}
                              </Badge>
                            )}
                          </div>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Add media / images</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <GifPicker
                          onSelectGif={handleInsertGif}
                          disabled={selectedImages.length >= 4}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">Insert GIF</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (!pollDraft) {
                            setPollDraft({
                              question: "",
                              pollType: "choice",
                              multiple: false,
                              options: ["", ""],
                            });
                          }
                          setShowPollModal(true);
                        }}
                        className={cn(
                          "h-8 w-8 cursor-pointer p-0 text-[#ff8a65] transition-colors hover:bg-slate-500/5 hover:text-[#ff8a65] dark:text-[#ff8a65] dark:hover:bg-white/5 dark:hover:text-[#ff8a65]/90",
                          pollDraft && "bg-slate-500/10 dark:bg-white/10"
                        )}
                      >
                        <Vote className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Add Poll</TooltipContent>
                  </Tooltip>

                  <div className="flex h-5 items-center gap-2 border-l border-slate-200 px-2 dark:border-white/10">
                    <Switch
                      id="share-to-discord-toggle"
                      checked={postToDiscord}
                      onCheckedChange={setPostToDiscord}
                      tone="discord"
                      className="border-slate-200 dark:border-white/10"
                    />
                    <label
                      htmlFor="share-to-discord-toggle"
                      className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-500 transition-colors select-none hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-300"
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
                    remainingChars < 0 ||
                    (plainText.trim().length === 0 &&
                      selectedVisualizations.length === 0 &&
                      selectedImages.length === 0)
                  }
                  className="h-7 cursor-pointer bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
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
          </motion.div>
        </div>
      </div>

      <MediaSearchModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onImageSelect={handleImageSelect}
      />

      {/* Poll Configuration Modal */}
      {/* Poll Configuration Modal */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showPollModal && pollDraft && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPollModal(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />

                {/* Modal Container */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="text-foreground relative z-10 w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/95"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/10">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#ff8a65]">
                      <Vote className="h-4 w-4" />
                      <span>Configure Poll Draft</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPollModal(false)}
                      className="h-7 w-7 cursor-pointer rounded-full text-slate-400 hover:bg-slate-500/10 hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Poll Question */}
                  <div className="space-y-1">
                    <label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Question / Topic *
                    </label>
                    <Input
                      type="text"
                      placeholder="Ask a question..."
                      value={pollDraft.question}
                      onChange={(e) => setPollDraft({ ...pollDraft, question: e.target.value })}
                      className="bg-background/50 w-full focus-visible:ring-[#ff8a65]/50"
                      required
                    />
                  </div>

                  {/* Poll Type & Multiple Options */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
                        Poll Type
                      </label>
                      <Select
                        value={pollDraft.pollType}
                        onValueChange={(val: "choice" | "feature-poll") =>
                          setPollDraft({
                            ...pollDraft,
                            pollType: val,
                          })
                        }
                      >
                        <SelectTrigger className="bg-background/50 h-8 w-full border border-slate-200 text-xs focus:border-[#ff8a65]/50 dark:border-white/10">
                          <SelectValue placeholder="Select Poll Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-[100020] border border-slate-200 text-xs dark:border-slate-800">
                          <SelectItem value="choice">Choice Poll</SelectItem>
                          {!isRegularUser && (
                            <SelectItem value="feature-poll">Feature Poll</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col justify-end space-y-1 pb-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="modal-poll-multiple-toggle"
                          checked={pollDraft.multiple}
                          onCheckedChange={(checked) =>
                            setPollDraft({ ...pollDraft, multiple: checked })
                          }
                          className="scale-90"
                        />
                        <label
                          htmlFor="modal-poll-multiple-toggle"
                          className="text-slate-650 cursor-pointer text-[11px] font-semibold dark:text-neutral-300"
                        >
                          Multiple Selection
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Blurb Prompt Notice for Regular Users */}
                  {isRegularUser && (
                    <div className="flex items-start gap-2 rounded-lg border border-[#ff8a65]/20 bg-[#ff8a65]/5 p-3 text-[11px] leading-relaxed text-[#ff8a65]">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Citizen accounts can only launch Choice Polls. To prioritize features,
                        create a structured roadmap, or run custom campaigns, submit a{" "}
                        <a
                          href={withBasePath("/blurbs")}
                          className="font-bold underline hover:text-[#ff8a65]/80"
                          onClick={() => setShowPollModal(false)}
                        >
                          Blurb prompt
                        </a>{" "}
                        instead.
                      </span>
                    </div>
                  )}

                  {/* Poll Options */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-muted-foreground block text-[10px] font-bold tracking-wider uppercase">
                        Options * (min 2)
                      </label>
                      <span className="text-muted-foreground/60 text-[9px] font-medium">
                        {pollDraft.options.filter((o) => o.trim()).length} / 10
                      </span>
                    </div>

                    <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
                      {pollDraft.options.map((option, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-muted-foreground/60 w-4 text-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <Input
                            type="text"
                            placeholder={`Option ${idx + 1}`}
                            value={option}
                            onChange={(e) => {
                              const updated = [...pollDraft.options];
                              updated[idx] = e.target.value;
                              setPollDraft({ ...pollDraft, options: updated });
                            }}
                            className="bg-background/50 flex-1 text-xs focus-visible:ring-[#ff8a65]/50"
                            required
                          />
                          {pollDraft.options.length > 2 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setPollDraft({
                                  ...pollDraft,
                                  options: pollDraft.options.filter((_, i) => i !== idx),
                                });
                              }}
                              className="h-7 w-7 shrink-0 cursor-pointer text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {pollDraft.options.length < 10 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPollDraft({
                            ...pollDraft,
                            options: [...pollDraft.options, ""],
                          });
                        }}
                        className="mt-1 h-8 w-full cursor-pointer border-dashed border-[#ff8a65]/35 text-[10px] font-semibold text-[#ff8a65] hover:bg-[#ff8a65]/10 dark:text-[#ff8a65]"
                      >
                        <Plus className="mr-1 h-3 w-3" /> Add Option
                      </Button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-3.5 dark:border-white/10">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setPollDraft(null);
                        setShowPollModal(false);
                      }}
                      className="h-8 cursor-pointer px-3 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                    >
                      Discard Poll
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const validOpts = pollDraft.options.map((o) => o.trim()).filter(Boolean);
                        if (!pollDraft.question.trim()) {
                          notify.error("Please enter a question");
                          return;
                        }
                        if (validOpts.length < 2) {
                          notify.error("At least 2 non-empty options are required");
                          return;
                        }
                        setShowPollModal(false);
                        notify.success("Poll configured successfully!");
                      }}
                      className="h-8 cursor-pointer bg-[#ff8a65] px-4 text-xs font-bold text-white hover:bg-[#ff8a65]/90"
                    >
                      Save & Apply
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </motion.div>
  );
}
