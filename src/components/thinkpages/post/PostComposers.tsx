"use client";
// src/components/thinkpages/post/PostComposers.tsx
// Inline edit and reply composer components matching the main GlassCanvasComposer aesthetic.

import { useRef, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  EditPencil as Edit,
  Send,
  SystemRestart as Loader2,
  Xmark as X,
  MediaImage as Image,
} from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import type { GlassPlateEditorRef } from "~/components/shared/editor";

const GlassPlateEditor = dynamic(
  () => import("~/components/shared/editor/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  {
    loading: () => <Skeleton className="rounded-control h-16" />,
    ssr: false,
  }
);
import { ComposerAccountSwitcher } from "../composer/ComposerAccountSwitcher";
import { GifPicker } from "../GifPicker";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils/cn";
import { springSmooth } from "~/lib/design/motion";

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

interface PostComposersProps {
  post: any;
  showEditComposer: boolean;
  setShowEditComposer: (val: boolean) => void;
  editText: string;
  setEditText: (val: string) => void;
  handleSubmitEdit: () => void;
  isEditPending?: boolean;

  showReplyComposer: boolean;
  setShowReplyComposer: (val: boolean) => void;
  replyText: string;
  setReplyText: (val: string) => void;
  handleSubmitReply: (mediaUrls?: string[]) => void;
  isReplyPending?: boolean;

  currentUserAccountId?: string;
  accounts?: any[];
  onAccountSelect?: (account: any) => void;
  onCreateAccount?: () => void;
  isOwner?: boolean;
  proxyDiscordUrl: (url: string) => string;
}

export function PostComposers({
  post,
  showEditComposer,
  setShowEditComposer,
  editText,
  setEditText,
  handleSubmitEdit,
  isEditPending,
  showReplyComposer,
  setShowReplyComposer,
  replyText,
  setReplyText,
  handleSubmitReply,
  isReplyPending,
  currentUserAccountId,
  accounts = [],
  onAccountSelect,
  onCreateAccount,
  isOwner = false,
  proxyDiscordUrl,
}: PostComposersProps) {
  const { user } = useUser();
  const replyEditorRef = useRef<GlassPlateEditorRef>(null);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showMediaModal, setShowMediaModal] = useState(false);

  const currentAccount =
    (accounts || []).find((acc: any) => acc.id === currentUserAccountId) || accounts?.[0];

  const getAccountAvatar = (acc: any) =>
    acc?.profileImageUrl
      ? proxyDiscordUrl(acc.profileImageUrl)
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(acc?.displayName || "A")}&background=3B82F6&color=fff&size=128&bold=true`;

  const replyAvatarUrl =
    currentAccount?.profileImageUrl || user?.imageUrl || (user as any)?.profileImageUrl || "";
  const replyDisplayName =
    currentAccount?.displayName ||
    user?.fullName ||
    user?.username ||
    (currentAccount ? `@${currentAccount.username}` : "You");

  const handleReplyChange = useCallback(
    (html: string, rawText: string) => {
      // Use html if rich elements present, otherwise rawText
      setReplyText(html.includes("<") && !html.startsWith("<p></p>") ? html : rawText);
    },
    [setReplyText]
  );

  const handleInsertGif = useCallback(
    (gifUrl: string) => {
      if (selectedImages.length >= 4) return;
      setSelectedImages((prev) => [...prev, gifUrl]);
    },
    [selectedImages.length]
  );

  const handleRemoveImage = useCallback((indexToRemove: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== indexToRemove));
  }, []);

  const onSubmitReply = useCallback(() => {
    handleSubmitReply(selectedImages);
    setSelectedImages([]);
  }, [handleSubmitReply, selectedImages]);

  useEffect(() => {
    if (!showReplyComposer && !showEditComposer) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showReplyComposer) {
          setShowReplyComposer(false);
          setSelectedImages([]);
        }
        if (showEditComposer) setShowEditComposer(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showReplyComposer, setShowReplyComposer, showEditComposer, setShowEditComposer]);

  return (
    <>
      {/* Edit Composer */}
      <AnimatePresence>
        {showEditComposer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={springSmooth}
            className="bg-surface-secondary rounded-row relative mt-3 flex flex-col gap-0 p-3"
          >
            <div className="relative flex items-start gap-3">
              <Avatar className="border-separator mt-0.5 size-9 shrink-0 border">
                <AvatarImage src={proxyDiscordUrl(post.account?.profileImageUrl || "")} />
                <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
                  {(post.account?.displayName ?? "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="text-subhead text-label flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Edit className="text-label-secondary size-4" aria-hidden="true" />
                    <span>Editing post</span>
                  </div>
                  <span className="text-footnote text-label-secondary">Esc to cancel</span>
                </div>
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Edit your post content..."
                  className="bg-surface"
                  rows={3}
                  autoFocus
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setShowEditComposer(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitEdit}
                    disabled={!editText.trim() || editText === post.content || isEditPending}
                  >
                    {isEditPending ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Composer - Styled identically to main GlassCanvasComposer */}
      <AnimatePresence>
        {showReplyComposer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={springSmooth}
            className="border-separator bg-surface rounded-row relative mt-3 flex flex-col gap-0 border p-3"
          >
            {/* Header info */}
            <div className="border-separator text-footnote text-label-secondary relative mb-2 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-1">
                <span>Replying to</span>
                <span className="text-tint font-medium hover:underline">
                  @{post.account?.username}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-footnote text-label-secondary hidden sm:inline">
                  Esc to cancel
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setShowReplyComposer(false);
                    setSelectedImages([]);
                  }}
                  className="text-label-secondary hover:text-label rounded-full"
                  title="Close (Esc)"
                  aria-label="Close reply"
                >
                  <X aria-hidden />
                </Button>
              </div>
            </div>

            <div className="relative flex gap-3">
              {/* Left column: Avatar + Floating Persona Switcher */}
              {currentAccount && accounts.length > 0 ? (
                <ComposerAccountSwitcher
                  account={currentAccount}
                  accounts={accounts}
                  accountAvatarUrl={getAccountAvatar(currentAccount)}
                  showAccountManager={showAccountManager}
                  setShowAccountManager={setShowAccountManager}
                  onAccountSelect={onAccountSelect}
                  onCreateAccount={onCreateAccount}
                  isOwner={isOwner ?? false}
                  getAccountAvatar={getAccountAvatar}
                />
              ) : (
                <Avatar className="border-separator mt-0.5 size-9 shrink-0 border">
                  {replyAvatarUrl && (
                    <AvatarImage src={proxyDiscordUrl(replyAvatarUrl)} alt={replyDisplayName} />
                  )}
                  <AvatarFallback className="bg-tint-fill text-caption text-tint">
                    {replyDisplayName
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              )}

              {/* Right column: Editor + Media Previews + Actions */}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="space-y-2">
                  <GlassPlateEditor
                    ref={replyEditorRef}
                    value={replyText}
                    onChange={handleReplyChange}
                    onSubmit={onSubmitReply}
                    submitOnEnter={true}
                    placeholder={`Reply to @${post.account?.username}...`}
                    disabled={isReplyPending}
                    minHeight={52}
                    maxHeight={200}
                    hideToolbar={false}
                  />
                </div>

                {/* Attached Images / GIFs Grid */}
                {selectedImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                    {selectedImages.map((imageUrl, index) => (
                      <div
                        key={imageUrl + index}
                        className="border-separator bg-fill-4 rounded-control relative aspect-video overflow-hidden border"
                      >
                        <button
                          onClick={() => handleRemoveImage(index)}
                          type="button"
                          className="material-thin text-label hover:text-destructive absolute top-1 right-1 z-10 cursor-pointer rounded-full p-1 transition-colors"
                          aria-label="Remove image"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <img
                          src={proxyDiscordUrl(imageUrl)}
                          alt={`Attached media ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Row */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 sm:gap-2">
                    {/* Media Search Modal Trigger */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowMediaModal(true)}
                          disabled={selectedImages.length >= 4}
                          className="text-tint hover:bg-tint-fill hover:text-tint size-8 p-0"
                          aria-label="Add media / images"
                        >
                          <div className="relative">
                            <Image className="h-4 w-4" />
                            {selectedImages.length > 0 && (
                              <Badge
                                variant="default"
                                className="border-background bg-tint text-on-tint text-footnote absolute -top-2 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border p-0 font-semibold"
                              >
                                {selectedImages.length}
                              </Badge>
                            )}
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-footnote">
                        Add media / images
                      </TooltipContent>
                    </Tooltip>

                    {/* GIF Picker Trigger */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <GifPicker
                          onSelectGif={handleInsertGif}
                          disabled={selectedImages.length >= 4}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-footnote">
                        Insert GIF
                      </TooltipContent>
                    </Tooltip>

                    <div className="bg-separator hidden h-4 w-px sm:block" />

                    <div className="text-footnote text-label-secondary hidden items-center gap-1 sm:flex">
                      <span>Press</span>
                      <kbd className="border-separator bg-fill-4 text-caption text-label-secondary rounded-control-sm border px-2 py-0.5">
                        Enter
                      </kbd>
                      <span>to reply</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowReplyComposer(false);
                        setSelectedImages([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={onSubmitReply}
                      disabled={
                        (!replyText.trim() && selectedImages.length === 0) || isReplyPending
                      }
                      className={cn(isReplyPending && "opacity-60")}
                    >
                      {isReplyPending ? (
                        <>
                          <Loader2 className="animate-spin" />
                          <span>Replying...</span>
                        </>
                      ) : (
                        <>
                          <Send />
                          <span>Reply</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Search Modal */}
      {showMediaModal && (
        <MediaSearchModal
          isOpen={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          onImageSelect={(imageUrl: string) => {
            if (selectedImages.length >= 4) return;
            if (imageUrl) {
              setSelectedImages((prev) => [...prev, imageUrl]);
            }
            setShowMediaModal(false);
          }}
        />
      )}
    </>
  );
}
