"use client";

import React from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import {
  Xmark as X,
  Refresh as Repeat2,
  Journal as Newspaper,
  CheckSquare as Vote,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { springSmooth } from "~/lib/design/motion";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { LiveDataCard } from "./LiveDataCard";
import { GlassPlateEditor } from "./GlassPlateEditor";

import { useGlassCanvasComposer } from "./composer/useGlassCanvasComposer";
import { ComposerAccountSwitcher } from "./composer/ComposerAccountSwitcher";
import { ComposerLiveDataDrawer } from "./composer/ComposerLiveDataDrawer";
import { ComposerActionBar } from "./composer/ComposerActionBar";
import { ComposerPollModal } from "./composer/ComposerPollModal";
import { usePostAsYourself, isPersonalAccount } from "./composer/usePostAsYourself";
import { Card } from "~/components/ui/card";

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

  const { postAsYourself, isPending: isPostAsYourselfPending } = usePostAsYourself(onAccountSelect);
  const hasPersonalAccount = accounts.some(isPersonalAccount);

  const characterLimit = 280;
  const remainingChars = characterLimit - plainText.length;

  if (accounts.length === 0) {
    return (
      <Card padding="lg">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-start gap-3">
            <div className="bg-tint-fill text-tint rounded-control flex size-9 shrink-0 items-center justify-center">
              <Newspaper className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-headline text-label">
                Post as yourself, or create a ThinkPages Account
              </h4>
              <p className="text-callout text-label-secondary mt-1">
                Post under your own name, or set up an in-character account for your nation to
                publish articles and join global community discussions.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Button size="sm" onClick={postAsYourself} disabled={isPostAsYourselfPending}>
              {isPostAsYourselfPending ? "Setting up..." : "Post as yourself"}
            </Button>
            {hasCountry && (
              <Button size="sm" variant="outline" onClick={onCreateAccount}>
                Create account
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // A personal persona needs no country, so only a missing selection blocks the composer.
  if (!account) {
    return (
      <Card padding="md" aria-busy="true">
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="rounded-control mb-3 h-16 w-full" />
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
          </div>
          <Skeleton className="h-7 w-16" />
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      layout
      ref={composerRef}
      className="border-separator bg-surface rounded-card shadow-card relative flex flex-col gap-0 border p-4"
      transition={springSmooth}
    >
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
          onPostAsYourself={hasPersonalAccount ? undefined : postAsYourself}
          isPostAsYourselfPending={isPostAsYourselfPending}
        />

        {/* Right column: Editor + Previews + Actions */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {repostData && (
            <div className="bg-surface-secondary rounded-row mb-1 p-3">
              <div className="text-footnote text-label-secondary mb-2 flex items-center gap-2">
                <Repeat2 className="size-3.5" aria-hidden="true" />
                <span>Reposting</span>
              </div>
              <div className="mb-2 flex items-center gap-2">
                <Avatar className="size-5">
                  <AvatarImage
                    src={repostData.originalPost.account?.profileImageUrl}
                    alt={repostData.originalPost.account?.displayName}
                  />
                  <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
                    {repostData.originalPost.account?.displayName?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-headline text-label">
                  {repostData.originalPost.account?.displayName || "Unknown"}
                </span>
                <span className="text-label-secondary text-footnote">
                  @{repostData.originalPost.account?.username || "unknown"}
                </span>
              </div>
              <div className="text-label-secondary text-footnote line-clamp-2">
                {repostData.originalPost.content}
              </div>
            </div>
          )}

          <div className="space-y-2">
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
                  className="rounded-control border-separator bg-fill-4 relative aspect-video overflow-hidden border"
                >
                  <button
                    type="button"
                    onClick={() => removeImage(imageUrl)}
                    aria-label="Remove image"
                    className="material-thin text-label hover:text-destructive absolute top-2 right-2 z-10 cursor-pointer rounded-full p-0.5 transition-colors"
                  >
                    <X className="size-3.5" />
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
            <div className="mt-1 space-y-2">
              {selectedVisualizations.map((viz) => (
                <div
                  key={viz.id}
                  className="border-separator bg-surface-secondary rounded-control relative border p-3"
                >
                  <button
                    type="button"
                    onClick={() => removeVisualization(viz.id)}
                    aria-label="Remove chart"
                    className="text-destructive hover:bg-destructive/10 absolute top-2 right-2 cursor-pointer rounded-full p-0.5 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                  <div className="space-y-2">
                    <div className="text-caption text-label">{viz.title}</div>
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
              transition={springSmooth}
              className="bg-surface-secondary rounded-row mt-2 flex items-center justify-between p-3"
            >
              <div className="flex items-center gap-2">
                <Vote className="text-tint size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-headline text-label truncate">
                    {pollDraft.question || "Untitled poll"}
                  </p>
                  <p className="text-label-secondary text-footnote">
                    {pollDraft.pollType === "choice" ? "Choice poll" : "Feature poll"} •{" "}
                    {pollDraft.options.filter((o) => o.trim()).length} options
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPollModal(true)}
                >
                  Edit poll
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPollDraft(null)}
                  aria-label="Remove poll"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X />
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
