"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { extractHashtags, extractMentions } from "~/lib/utils";
import {
  VISUALIZATION_SPECS,
  buildVisualization,
  describeAvailability,
  type DataVisualization,
  type VisualizationType,
} from "./visualizationSpecs";

const MAX_IMAGES = 4;

const fallbackAvatar = (name?: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "A")}&background=3B82F6&color=fff&size=128&bold=true`;

interface PollDraft {
  question: string;
  pollType: "choice" | "feature-poll";
  multiple: boolean;
  options: string[];
}

const filledOptions = (poll: PollDraft) =>
  poll.options.map((opt) => opt.trim()).filter((opt) => opt.length > 0);

/** The first problem with a poll draft, if any. */
function pollError(poll: PollDraft): string | null {
  if (!poll.question.trim()) return "Please enter a poll question";
  return filledOptions(poll).length < 2 ? "A poll must have at least 2 options" : null;
}

interface UseGlassCanvasComposerProps {
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
  const utils = api.useUtils();
  const isRegularUser = !isOwner && account?.accountType === "citizen";
  const { data: channelTopic } = api.thinkpages.getDiscordChannelTopic.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const [showDiscordTopic, setShowDiscordTopic] = useState(false);
  const editorRef = useRef<any>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [plainText, setPlainText] = useState("");
  const [selectedVisualizations, setSelectedVisualizations] = useState<DataVisualization[]>([]);
  const [showVisualizationPanel, setShowVisualizationPanel] = useState(false);
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [postToDiscord, setPostToDiscord] = useState(true);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [pollDraft, setPollDraft] = useState<PollDraft | null>(null);
  const [showPollModal, setShowPollModal] = useState(false);

  useEffect(() => {
    // Surface the Discord channel topic as the placeholder in dev and for ~10% of sessions
    if (channelTopic && (process.env.NODE_ENV === "development" || Math.random() < 0.1)) {
      // oxlint-disable-next-line
      setShowDiscordTopic(true);
    }
  }, [channelTopic]);

  const resolvedPlaceholder = showDiscordTopic && !isEditorFocused ? channelTopic : placeholder;
  const accountAvatarUrl = account
    ? account.profileImageUrl || fallbackAvatar(account.displayName)
    : "";
  const getAccountAvatar = (acc: any) => acc.profileImageUrl || fallbackAvatar(acc.displayName);

  const hasContent =
    plainText.trim().length > 0 || selectedImages.length > 0 || selectedVisualizations.length > 0;
  const showActionBar = isEditorFocused || hasContent || showVisualizationPanel;

  const liveQuery = { enabled: !!countryId, refetchOnWindowFocus: false };
  const { data: economicData, isLoading: isLoadingEconomic } =
    api.countries.getByIdWithEconomicData.useQuery({ id: countryId }, liveQuery);
  const { data: gdpHistoryData, isLoading: isLoadingHistory } =
    api.historical.getCountryHistory.useQuery({ countryId, limit: 30 }, liveQuery);
  const { data: diplomaticData, isLoading: isLoadingDiplomatic } =
    api.diplomaticCore.getRelationships.useQuery({ countryId }, liveQuery);
  const { data: tradeData, isLoading: isLoadingTrade } = api.countries.getTradeData.useQuery(
    { countryId },
    liveQuery
  );
  const { data: vitalityData, isLoading: isLoadingVitality } =
    api.countries.getActivityRingsData.useQuery({ countryId }, liveQuery);

  const sources = { economicData, gdpHistoryData, diplomaticData, tradeData, vitalityData };
  const availability = describeAvailability(sources);

  // A wiki article "repost" (WikiFeedCard / InlineWikiArticlePreview) has no ThinkPages post
  // behind it: its id is `wiki-<title>`, which would fail the repostOf foreign key. Post it as
  // an original post that carries the article's blurb link instead.
  const repostOriginal = repostData?.originalPost as
    { id?: string | number; content?: string } | undefined;
  const isWikiRepost =
    typeof repostOriginal?.id === "string" && repostOriginal.id.startsWith("wiki-");
  const repostOfId =
    repostOriginal?.id != null && !isWikiRepost ? String(repostOriginal.id) : undefined;
  const wikiRepostContent = isWikiRepost ? (repostOriginal?.content ?? "").trim() : "";

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      // The one success toast for a post or repost (callers' onPost only closes / refreshes).
      notify.success(repostData ? "Reposted to ThinkPages" : "Post shared successfully!");
      setContent("");
      setPlainText("");
      editorRef.current?.clear();
      setSelectedVisualizations([]);
      setSelectedImages([]);
      setPollDraft(null);
      setPostToDiscord(true);
      void utils.thinkpages.getFeed.invalidate();
      void utils.activities.getGlobalFeed.invalidate();
      void utils.activities.getFollowingFeed.invalidate();
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

  const handleSubmit = () => {
    if (!account) return;

    const isEmpty =
      !plainText.trim() &&
      selectedVisualizations.length === 0 &&
      selectedImages.length === 0 &&
      !pollDraft &&
      !repostData; // a repost needs no comment of its own
    const invalid = isEmpty
      ? "Please add content, a visualization, an image, or a poll"
      : pollDraft && pollError(pollDraft);
    if (invalid) {
      notify.error(invalid);
      return;
    }

    createPostMutation.mutate({
      accountId: account.id,
      content: [content.trim(), wikiRepostContent].filter(Boolean).join("\n\n"),
      hashtags: extractHashtags(plainText),
      mentions: extractMentions(plainText),
      visibility: "public" as const,
      visualizations: selectedVisualizations.map(({ type, title, config }) => ({
        type,
        title,
        config,
      })),
      mediaUrls: selectedImages,
      repostOfId,
      postToDiscord,
      poll: pollDraft
        ? {
            question: pollDraft.question.trim(),
            pollType: pollDraft.pollType,
            multiple: pollDraft.multiple,
            options: filledOptions(pollDraft),
          }
        : undefined,
    });
  };

  const addVisualization = (type: VisualizationType) => {
    const { available, missing, title } = VISUALIZATION_SPECS[type];
    if (!availability[available]) {
      notify.error(missing);
      return;
    }

    setIsGeneratingVisualization(true);
    setTimeout(() => {
      setSelectedVisualizations((prev) => [...prev, buildVisualization(type, sources)]);
      setIsGeneratingVisualization(false);
      notify.success(`${title} added to post`);
    }, 800);
  };

  /** Adds an image or GIF unless the post already has the maximum. */
  const addImage = (url: string, limitMessage: string, addedMessage: string) => {
    if (selectedImages.length >= MAX_IMAGES) {
      notify.error(limitMessage);
      return false;
    }
    setSelectedImages((prev) => [...prev, url]);
    notify.success(addedMessage);
    return true;
  };

  const handleInsertGif = (gifUrl: string) =>
    addImage(gifUrl, "Maximum 4 images/GIFs per post", "GIF added to post");

  const handleImageSelect = (imageUrl: string) => {
    if (addImage(imageUrl, "Maximum 4 images per post", "Image added to post")) {
      setShowMediaModal(false);
    }
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
    showVisualizationPanel,
    setShowVisualizationPanel,
    isGeneratingVisualization,
    showAccountManager,
    setShowAccountManager,
    selectedImages,
    showMediaModal,
    setShowMediaModal,
    postToDiscord,
    setPostToDiscord,
    setIsEditorFocused,
    pollDraft,
    setPollDraft,
    showPollModal,
    setShowPollModal,
    resolvedPlaceholder,
    accountAvatarUrl,
    getAccountAvatar,
    handleInsertGif,
    showActionBar,
    ...availability,
    isLoadingEconomic,
    isLoadingHistory,
    isLoadingDiplomatic,
    isLoadingTrade,
    isLoadingVitality,
    createPostMutation,
    handleSubmit,
    addVisualization,
    removeVisualization: (id: string) =>
      setSelectedVisualizations((prev) => prev.filter((viz) => viz.id !== id)),
    handleImageSelect,
    removeImage: (imageUrl: string) =>
      setSelectedImages((prev) => prev.filter((url) => url !== imageUrl)),
    economicData,
    gdpHistoryData,
    diplomaticData,
    tradeData,
    vitalityData,
  };
}
