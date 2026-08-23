// src/components/thinkpages/post/PostComposers.tsx
// Inline edit and reply composer components matching the main GlassCanvasComposer aesthetic with Apple Design physics.

"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { EditPencil as Edit, Send, SystemRestart as Loader2, Xmark as X, MediaImage as Image } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { GlassPlateEditor, type GlassPlateEditorRef } from "~/components/shared/editor";
import { ComposerAccountSwitcher } from "../composer/ComposerAccountSwitcher";
import { GifPicker } from "../GifPicker";
import { useUser } from "~/context/auth-context";
import { ACCOUNT_TYPE_COLORS } from "./ThinkpagesPostUtils";
import { cn } from "~/lib/utils";

const MediaSearchModal = dynamic(
  () => import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

export interface PostComposersProps {
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

  const handleInsertGif = useCallback((gifUrl: string) => {
    if (selectedImages.length >= 4) return;
    setSelectedImages((prev) => [...prev, gifUrl]);
  }, [selectedImages.length]);

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
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative mt-3 flex flex-col gap-0 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 shadow-xl backdrop-blur-2xl transition-all duration-200 hover:shadow-2xl"
          >
            <TextureOverlay texture="paperGrain" opacity={0.03} className="rounded-2xl" />

            <div className="relative flex items-start gap-3">
              <Avatar className="mt-0.5 h-9 w-9 shrink-0 border border-amber-500/30 shadow-md">
                <AvatarImage src={proxyDiscordUrl(post.account?.profileImageUrl || "")} />
                <AvatarFallback className="bg-amber-500/20 text-xs font-bold text-amber-300">
                  {(post.account?.displayName ?? "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                  <div className="flex items-center gap-1.5">
                    <Edit className="h-3.5 w-3.5" />
                    <span>Editing Post</span>
                  </div>
                  <span className="text-muted-foreground/60 text-[10px] font-normal">Esc to cancel</span>
                </div>
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Edit your post content..."
                  className="border-border/30 bg-background/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-amber-500/50 rounded-xl text-xs focus-visible:ring-1"
                  rows={3}
                  autoFocus
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEditComposer(false)}
                    className="text-muted-foreground hover:bg-muted/30 hover:text-foreground h-8 rounded-xl px-3 text-xs font-medium transition-all active:scale-95"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitEdit}
                    disabled={!editText.trim() || editText === post.content || isEditPending}
                    className="shadow-amber-600/25 h-8 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white shadow-md transition-all hover:bg-amber-500 active:scale-95"
                  >
                    {isEditPending ? "Saving..." : "Save Changes"}
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
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
            className={cn(
              "relative mt-3 flex flex-col gap-0 rounded-2xl border border-black/10 bg-white/70 p-3.5 shadow-xl backdrop-blur-2xl transition-all duration-200 hover:shadow-2xl dark:border-border/80 dark:bg-card/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            )}
          >
            <TextureOverlay texture="paperGrain" opacity={0.03} className="rounded-2xl" />

            {/* Header info */}
            <div className="relative mb-2.5 flex items-center justify-between border-b border-black/5 pb-2 text-xs text-muted-foreground dark:border-white/5">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="text-muted-foreground/70">Replying to</span>
                <span className="font-semibold text-blue-500 hover:underline">@{post.account?.username}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-[10px] text-muted-foreground/50 sm:inline">Esc to cancel</span>
                <button
                  onClick={() => {
                    setShowReplyComposer(false);
                    setSelectedImages([]);
                  }}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                  title="Close (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
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
                <Avatar className="mt-0.5 h-9 w-9 shrink-0 border border-white/20 shadow-md dark:border-white/10">
                  {replyAvatarUrl && (
                    <AvatarImage
                      src={proxyDiscordUrl(replyAvatarUrl)}
                      alt={replyDisplayName}
                    />
                  )}
                  <AvatarFallback className="bg-blue-600 text-xs font-bold text-white">
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
                <div className="space-y-1.5">
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
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                    {selectedImages.map((imageUrl, index) => (
                      <div
                        key={imageUrl + index}
                        className="relative aspect-video overflow-hidden rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                      >
                        <button
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 z-10 cursor-pointer rounded-full bg-black/70 p-1 text-white transition-colors hover:bg-red-500 active:scale-95"
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
                          className="h-8 w-8 rounded-xl p-0 text-emerald-600 transition-all hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 active:scale-95"
                          aria-label="Add media / images"
                        >
                          <div className="relative">
                            <Image className="h-4 w-4" />
                            {selectedImages.length > 0 && (
                              <Badge
                                variant="secondary"
                                className="border-background absolute -top-2 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border bg-emerald-500 p-0 text-[7px] font-bold text-white shadow-xs"
                              >
                                {selectedImages.length}
                              </Badge>
                            )}
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[11px]">
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
                      <TooltipContent side="top" className="text-[11px]">
                        Insert GIF
                      </TooltipContent>
                    </Tooltip>

                    <div className="hidden h-4 w-px bg-black/10 dark:bg-white/10 sm:block" />

                    <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                      <span>Press</span>
                      <kbd className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
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
                      className="h-8 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition-all hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white active:scale-95"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={onSubmitReply}
                      disabled={(!replyText.trim() && selectedImages.length === 0) || isReplyPending}
                      className={cn(
                        "h-8 gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-500 active:scale-95",
                        isReplyPending && "opacity-60"
                      )}
                    >
                      {isReplyPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Replying...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
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
