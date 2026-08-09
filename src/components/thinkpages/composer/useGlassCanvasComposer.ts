"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

export interface DataVisualization {
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

export interface UseGlassCanvasComposerProps {
  account: any | null;
  countryId: string;
  isOwner: boolean;
  onPost: () => void;
  placeholder?: string;
  repostData?: {
    originalPost: any;
    mode: "repost";
  };
}

export function useGlassCanvasComposer({
  account,
  countryId,
  isOwner,
  onPost,
  placeholder = "What's happening?",
  repostData,
}: UseGlassCanvasComposerProps) {
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
    acc?.profileImageUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(acc?.displayName || "A")}&background=3B82F6&color=fff&size=128&bold=true`;

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
  const { data: economicData } = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );
  const { data: gdpHistoryData } = api.historical.getCountryHistory.useQuery(
    { countryId, limit: 30 },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );
  const { data: diplomaticData } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );
  const { data: tradeData } = api.countries.getTradeData.useQuery(
    { countryId },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );
  const { data: vitalityData } = api.countries.getActivityRingsData.useQuery(
    { countryId },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );

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

  const extractHashtags = (text: string): string[] => {
    const hashtags = text.match(/#[\w]+/g);
    return hashtags ? hashtags.map((tag) => tag.substring(1)) : [];
  };

  const extractMentions = (text: string): string[] => {
    const mentions = text.match(/@[\w]+/g);
    return mentions ? mentions.map((mention) => mention.substring(1)) : [];
  };

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
    notify,
  ]);

  const addVisualization = (type: DataVisualization["type"]) => {
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
            title: "Global Diplomatic Stance",
            data: diplomaticData || [],
            config: {
              mapProjection: "naturalEarth",
              colorScheme: "diplomatic",
              showLabels: true,
            },
          };
          break;
        case "trade_flow":
          newVisualization = {
            id: `trade-${Date.now()}`,
            type: "trade_flow",
            title: "Bilateral Trade Networks",
            data: tradeData || {},
            config: {
              flowStyle: "curved",
              minTradeValue: 1000000,
            },
          };
          break;
        case "gdp_growth":
          newVisualization = {
            id: `gdp-${Date.now()}`,
            type: "gdp_growth",
            title: "GDP Breakdown",
            data: economicData || {},
            config: { showSubcategories: true },
          };
          break;
        case "demographics":
          newVisualization = {
            id: `demo-${Date.now()}`,
            type: "demographics",
            title: "Population Pyramid",
            data: economicData || {},
            config: { ageGroups: 5 },
          };
          break;
        case "budget_debt":
          newVisualization = {
            id: `budget-${Date.now()}`,
            type: "budget_debt",
            title: "Fiscal Overview",
            data: economicData || {},
            config: { showDebtRatio: true },
          };
          break;
        case "labor_market":
          newVisualization = {
            id: `labor-${Date.now()}`,
            type: "labor_market",
            title: "Employment Statistics",
            data: economicData || {},
            config: { showParticipationRate: true },
          };
          break;
        case "national_vitality":
          newVisualization = {
            id: `vitality-${Date.now()}`,
            type: "national_vitality",
            title: "Activity Rings",
            data: vitalityData || {},
            config: { showTarget: true },
          };
          break;
      }

      setSelectedVisualizations((prev) => [...prev, newVisualization]);
      setIsGeneratingVisualization(false);
      setShowVisualizationPanel(false);
      notify.success("Live visualization attached");
    }, 500);
  };

  const removeVisualization = (id: string) => {
    setSelectedVisualizations((prev) => prev.filter((v) => v.id !== id));
  };

  return {
    notify,
    isRegularUser,
    editorRef,
    composerRef,
    content,
    setContent,
    plainText,
    setPlainText,
    selectedVisualizations,
    setSelectedVisualizations,
    showVisualizationPanel,
    setShowVisualizationPanel,
    isGeneratingVisualization,
    showAccountManager,
    setShowAccountManager,
    selectedImages,
    setSelectedImages,
    showMediaModal,
    setShowMediaModal,
    isUploadingImage,
    setIsUploadingImage,
    postToDiscord,
    setPostToDiscord,
    isEditorFocused,
    setIsEditorFocused,
    pollDraft,
    setPollDraft,
    showPollModal,
    setShowPollModal,
    resolvedPlaceholder,
    accountAvatarUrl,
    getAccountAvatar,
    handleInsertGif,
    hasContent,
    showActionBar,
    hasEconomicData,
    hasHistoricalData,
    hasDiplomaticData,
    hasTradeData,
    hasVitalityData,
    createPostMutation,
    handleSubmit,
    addVisualization,
    removeVisualization,
  };
}
