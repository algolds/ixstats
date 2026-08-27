"use client";

import React from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import {
  Xmark as X,
  Refresh as Repeat2,
  Journal as Newspaper,
  CheckSquare as Vote,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { LiveDataCard } from "./LiveDataCard";
import { GlassPlateEditor } from "./GlassPlateEditor";

import { useGlassCanvasComposer } from "./composer/useGlassCanvasComposer";
import { ComposerAccountSwitcher } from "./composer/ComposerAccountSwitcher";
import { ComposerLiveDataDrawer } from "./composer/ComposerLiveDataDrawer";
import { ComposerActionBar } from "./composer/ComposerActionBar";
import { ComposerPollModal } from "./composer/ComposerPollModal";

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
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
  // oxlint-disable-next-line eslint/no-unused-vars
  onAccountSettings,
  onCreateAccount,
  isOwner,
  onPost,
  placeholder = "What's happening?",
  countryId,
  repostData,
  // oxlint-disable-next-line eslint/no-unused-vars
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
    showMediaModal,
    setShowMediaModal,
    isUploadingImage,
    postToDiscord,
    setPostToDiscord,
    // oxlint-disable-next-line eslint/no-unused-vars
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
    showActionBar,
    hasEconomicData,
    hasHistoricalData,
    hasDiplomaticData,
    hasTradeData,
    hasVitalityData,
    isLoadingEconomic,
    isLoadingHistory,
    isLoadingDiplomatic,
    isLoadingTrade,
    isLoadingVitality,
    createPostMutation,
    handleSubmit,
    addVisualization,
    removeVisualization,
    handleImageSelect,
    removeImage,
    economicData,
    gdpHistoryData,
    diplomaticData,
    tradeData,
    vitalityData,
  } = useGlassCanvasComposer({
    account,
    countryId,
    isOwner,
    onPost,
    placeholder,
    repostData,
  });

  const getVisualizationPreview = (viz: any) => {
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

  if (accounts.length === 0) {
    return (
      <Card className="facet-hierarchy-child border-poll/35 bg-poll/5 relative gap-0 overflow-hidden p-5">
        <TextureOverlay texture="paperGrain" opacity={0.06} />
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-start gap-3">
            <div className="border-poll/20 bg-poll/15 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
              <Newspaper className="text-poll h-5 w-5" />
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
            className="bg-poll hover:bg-poll/90 h-8 shrink-0 cursor-pointer border-0 text-xs text-white shadow-sm transition-all active:scale-95"
          >
            Create Account
          </Button>
        </div>
      </Card>
    );
  }

  if (!hasCountry || !account) {
    return (
      <Card className="facet-hierarchy-child relative animate-pulse gap-0 overflow-hidden border-blue-500/10 bg-blue-500/5 p-4">
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
        "dark:border-border dark:bg-card/80 relative flex flex-col gap-0 rounded-2xl border border-black/10 bg-white/70 p-3.5 shadow-xl backdrop-blur-2xl transition-all duration-200 hover:shadow-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      )}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 30,
      }}
    >
      <TextureOverlay texture="paperGrain" opacity={0.04} className="rounded-2xl" />

      <div className="relative flex gap-3">
        {/* Left column: Avatar + Floating Switcher */}
        <ComposerAccountSwitcher
          account={account}
          accounts={accounts}
          accountAvatarUrl={accountAvatarUrl}
          showAccountManager={showAccountManager}
          setShowAccountManager={setShowAccountManager}
          onAccountSelect={onAccountSelect}
          onCreateAccount={onCreateAccount}
          isOwner={isOwner}
          getAccountAvatar={getAccountAvatar}
        />

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
              placeholder={resolvedPlaceholder ?? undefined}
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
              className="border-poll/20 bg-poll/5 mt-1.5 flex items-center justify-between rounded-xl border p-3.5"
            >
              <div className="flex items-center gap-2">
                <Vote className="text-poll h-4 w-4 shrink-0" />
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
                  className="border-poll/30 text-poll hover:bg-poll/10 h-7 cursor-pointer px-2.5 text-[10px] font-semibold transition-all active:scale-95"
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

          {/* Live Data Drawer */}
          <ComposerLiveDataDrawer
            showVisualizationPanel={showVisualizationPanel}
            isGeneratingVisualization={isGeneratingVisualization}
            isLoadingEconomic={isLoadingEconomic}
            isLoadingHistory={isLoadingHistory}
            isLoadingDiplomatic={isLoadingDiplomatic}
            isLoadingTrade={isLoadingTrade}
            isLoadingVitality={isLoadingVitality}
            hasEconomicData={hasEconomicData}
            hasHistoricalData={hasHistoricalData}
            hasDiplomaticData={hasDiplomaticData}
            hasTradeData={hasTradeData}
            hasVitalityData={hasVitalityData}
            addVisualization={addVisualization}
          />

          {/* Action Bar */}
          <ComposerActionBar
            showActionBar={showActionBar}
            remainingChars={remainingChars}
            showVisualizationPanel={showVisualizationPanel}
            setShowVisualizationPanel={setShowVisualizationPanel}
            isGeneratingVisualization={isGeneratingVisualization}
            setShowMediaModal={setShowMediaModal}
            isUploadingImage={isUploadingImage}
            selectedImages={selectedImages}
            handleInsertGif={handleInsertGif}
            pollDraft={pollDraft}
            setPollDraft={setPollDraft}
            setShowPollModal={setShowPollModal}
            postToDiscord={postToDiscord}
            setPostToDiscord={setPostToDiscord}
            handleSubmit={handleSubmit}
            isPending={createPostMutation.isPending}
            plainText={plainText}
            selectedVisualizations={selectedVisualizations}
          />
        </div>
      </div>

      <MediaSearchModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onImageSelect={handleImageSelect}
      />

      <ComposerPollModal
        showPollModal={showPollModal}
        setShowPollModal={setShowPollModal}
        pollDraft={pollDraft}
        setPollDraft={setPollDraft}
        isRegularUser={isRegularUser}
        notify={notify}
      />
    </motion.div>
  );
}
