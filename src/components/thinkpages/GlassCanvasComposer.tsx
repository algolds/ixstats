// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from "react";
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
  Users,
  Newspaper,
  Vote,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Switch } from "~/components/ui/switch";
import { withBasePath } from "~/lib/base-path";
import { GifPicker } from "./GifPicker";
import { LiveDataCard } from "./LiveDataCard";
import { GlassPlateEditor } from "./GlassPlateEditor";
import { ComposerHeader } from "./composer/ComposerHeader";
import { ComposerVisualizationsPanel } from "./composer/ComposerVisualizationsPanel";
import { ComposerPollModal } from "./composer/ComposerPollModal";
import { ComposerToolbar } from "./composer/ComposerToolbar";
import { useGlassCanvasComposer } from "./composer/useGlassCanvasComposer";

const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

export interface GlassCanvasComposerProps {
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
  isSignedIn = true,
  hasCountry = true,
}: GlassCanvasComposerProps) {
  const {
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
  } = useGlassCanvasComposer({
    account,
    countryId,
    isOwner,
    onPost,
    placeholder,
    repostData,
  });

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

  const characterLimit = 280;
  const remainingChars = characterLimit - plainText.length;

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

  return (
    <Card
      ref={composerRef}
      className={cn(
        "glass-hierarchy-child transition-all duration-300",
        isEditorFocused && "ring-2 ring-blue-500/30 dark:ring-blue-400/30"
      )}
    >
      <div className="p-4">
        {/* Header */}
        <ComposerHeader
          account={account}
          accounts={accounts}
          onAccountSelect={onAccountSelect}
          onAccountSettings={onAccountSettings}
          onCreateAccount={onCreateAccount}
          isOwner={isOwner}
          postToDiscord={postToDiscord}
          setPostToDiscord={setPostToDiscord}
        />

        {/* Repost context banner */}
        {repostData && (
          <div className="mb-3 rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-xs text-green-400">
            <div className="flex items-center gap-1.5 font-medium">
              <Repeat2 className="h-3.5 w-3.5" />
              <span>Reposting @{repostData.originalPost.account.username}'s post</span>
            </div>
          </div>
        )}

        {/* Rich Text Editor */}
        <div className="min-h-[120px]">
          <GlassPlateEditor
            ref={editorRef}
            placeholder={resolvedPlaceholder}
            onChange={(html, text) => {
              setContent(html);
              setPlainText(text);
            }}
            onFocus={() => setIsEditorFocused(true)}
            onBlur={() => setIsEditorFocused(false)}
          />
        </div>

        {/* Selected Images Grid */}
        {selectedImages.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {selectedImages.map((imgUrl, index) => (
              <div key={index} className="relative group overflow-hidden rounded-lg">
                <img src={imgUrl} alt="Attached" className="h-32 w-full object-cover" />
                <button
                  onClick={() => removeImage(imgUrl)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Selected Visualizations List */}
        {selectedVisualizations.length > 0 && (
          <div className="mt-3 space-y-2">
            {selectedVisualizations.map((viz) => (
              <div key={viz.id} className="relative group">
                <LiveDataCard type={viz.type} title={viz.title} countryId={countryId} />
                <button
                  onClick={() => removeVisualization(viz.id)}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Poll Draft Preview */}
        {pollDraft && (
          <div className="mt-3 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-400">Attached Poll</span>
              <button onClick={() => setPollDraft(null)} className="text-purple-400 hover:text-purple-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm font-medium">{pollDraft.question}</p>

            <div className="mt-2 space-y-1">
              {pollDraft.options.map((opt, i) => (
                <div key={i} className="rounded bg-white/5 px-2 py-1 text-xs text-muted-foreground">
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visualizations Panel */}
        <AnimatePresence>
          {showVisualizationPanel && (
            <ComposerVisualizationsPanel
              onSelect={addVisualization}
              onClose={() => setShowVisualizationPanel(false)}
              hasEconomicData={hasEconomicData}
              hasHistoricalData={hasHistoricalData}
              hasDiplomaticData={hasDiplomaticData}
              hasTradeData={hasTradeData}
              hasVitalityData={hasVitalityData}
              isGenerating={isGeneratingVisualization}
            />
          )}
        </AnimatePresence>

        {/* Composer Toolbar & Action Bar */}
        <ComposerToolbar
          showActionBar={showActionBar}
          remainingChars={remainingChars}
          hasContent={hasContent}
          isSubmitting={createPostMutation.isPending}
          onSubmit={handleSubmit}
          onToggleVisualizations={() => setShowVisualizationPanel(!showVisualizationPanel)}
          onOpenMediaModal={() => setShowMediaModal(true)}
          onInsertGif={handleInsertGif}
          onOpenPollModal={() => setShowPollModal(true)}
        />
      </div>

      {/* Media Search Modal */}
      {showMediaModal && (
        <MediaSearchModal
          isOpen={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          onSelectMedia={(url) => handleImageSelect(url)}
        />
      )}

      {/* Poll Creation Modal */}
      {showPollModal && (
        <ComposerPollModal
          isOpen={showPollModal}
          onClose={() => setShowPollModal(false)}
          onSave={(poll) => {
            setPollDraft(poll);
            setShowPollModal(false);
          }}
        />
      )}
    </Card>
  );
}
