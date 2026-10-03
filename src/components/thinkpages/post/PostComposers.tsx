"use client";

import { useEffect, useState } from "react";
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
import { ComposerAccountSwitcher } from "../composer/ComposerAccountSwitcher";
import { GifPicker } from "../GifPicker";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils/cn";
import { springSmooth } from "~/lib/design/motion";
import { getInitials, proxyDiscordUrl } from "./ThinkpagesPostUtils";
import type { PostState, PostViewContext } from "./postViewTypes";

const GlassPlateEditor = dynamic(
  () => import("~/components/shared/editor/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  {
    loading: () => <Skeleton className="rounded-control h-16" />,
    ssr: false,
  }
);

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

const MAX_ATTACHMENTS = 4;

/** Closes the composer on Escape while it is mounted. */
function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
}

const getAccountAvatar = (acc: any) =>
  acc?.profileImageUrl
    ? proxyDiscordUrl(acc.profileImageUrl)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(acc?.displayName || "A")}&background=3B82F6&color=fff&size=128&bold=true`;

function EditComposer({ post, state }: { post: any; state: PostState }) {
  const { editText, setEditText, setShowEditComposer, handleSubmitEdit } = state;
  const isPending = state.updatePostMutation.isPending;
  useEscapeToClose(() => setShowEditComposer(false));

  return (
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
              disabled={!editText.trim() || editText === post.content || isPending}
            >
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ReplyAuthorAvatar({ ctx, currentAccount }: { ctx: PostViewContext; currentAccount: any }) {
  const { user } = useUser();
  const [showAccountManager, setShowAccountManager] = useState(false);
  const accounts = ctx.accounts ?? [];

  if (currentAccount && accounts.length > 0) {
    return (
      <ComposerAccountSwitcher
        account={currentAccount}
        accounts={accounts}
        accountAvatarUrl={getAccountAvatar(currentAccount)}
        showAccountManager={showAccountManager}
        setShowAccountManager={setShowAccountManager}
        onAccountSelect={ctx.onAccountSelect}
        onCreateAccount={ctx.onCreateAccount}
        isOwner={ctx.isOwner ?? false}
        getAccountAvatar={getAccountAvatar}
      />
    );
  }

  const avatarUrl =
    currentAccount?.profileImageUrl || user?.imageUrl || (user as any)?.profileImageUrl || "";
  const displayName =
    currentAccount?.displayName ||
    user?.fullName ||
    user?.username ||
    (currentAccount ? `@${currentAccount.username}` : "You");

  return (
    <Avatar className="border-separator mt-0.5 size-9 shrink-0 border">
      {avatarUrl && <AvatarImage src={proxyDiscordUrl(avatarUrl)} alt={displayName} />}
      <AvatarFallback className="bg-tint-fill text-caption text-tint">
        {getInitials(displayName).slice(0, 2) || "U"}
      </AvatarFallback>
    </Avatar>
  );
}

function ReplyComposer({
  post,
  state,
  ctx,
}: {
  post: any;
  state: PostState;
  ctx: PostViewContext;
}) {
  const { replyText, setReplyText, setShowReplyComposer, handleSubmitReply } = state;
  const isPending = state.createPostMutation.isPending;
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const accounts = ctx.accounts ?? [];

  const currentAccount =
    accounts.find((acc: any) => acc.id === ctx.currentUserAccountId) || accounts[0];
  const atLimit = selectedImages.length >= MAX_ATTACHMENTS;

  const close = () => {
    setShowReplyComposer(false);
    setSelectedImages([]);
  };
  useEscapeToClose(close);

  const addImage = (url: string) => {
    if (!atLimit) setSelectedImages((prev) => [...prev, url]);
  };

  const submit = () => {
    void handleSubmitReply(selectedImages);
    setSelectedImages([]);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={springSmooth}
        className="border-separator bg-surface rounded-row relative mt-3 flex flex-col gap-0 border p-3"
      >
        <div className="border-separator text-footnote text-label-secondary relative mb-2 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1">
            <span>Replying to</span>
            <span className="text-tint font-medium hover:underline">@{post.account?.username}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-footnote text-label-secondary hidden sm:inline">
              Esc to cancel
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={close}
              className="text-label-secondary hover:text-label rounded-full"
              title="Close (Esc)"
              aria-label="Close reply"
            >
              <X aria-hidden />
            </Button>
          </div>
        </div>

        <div className="relative flex gap-3">
          <ReplyAuthorAvatar ctx={ctx} currentAccount={currentAccount} />

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="space-y-2">
              <GlassPlateEditor
                value={replyText}
                onChange={(html: string, rawText: string) =>
                  // Keep the HTML only when it carries rich elements
                  setReplyText(html.includes("<") && !html.startsWith("<p></p>") ? html : rawText)
                }
                onSubmit={submit}
                submitOnEnter={true}
                placeholder={`Reply to @${post.account?.username}...`}
                disabled={isPending}
                minHeight={52}
                maxHeight={200}
                hideToolbar={false}
              />
            </div>

            {selectedImages.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                {selectedImages.map((imageUrl, index) => (
                  <div
                    key={imageUrl + index}
                    className="border-separator bg-fill-4 rounded-control relative aspect-video overflow-hidden border"
                  >
                    <button
                      onClick={() =>
                        setSelectedImages((prev) => prev.filter((_, i) => i !== index))
                      }
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

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1 sm:gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMediaModal(true)}
                      disabled={atLimit}
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

                <Tooltip>
                  <TooltipTrigger asChild>
                    <GifPicker onSelectGif={addImage} disabled={atLimit} />
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
                <Button variant="ghost" size="sm" onClick={close}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={(!replyText.trim() && selectedImages.length === 0) || isPending}
                  className={cn(isPending && "opacity-60")}
                >
                  {isPending ? (
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

      {showMediaModal && (
        <MediaSearchModal
          isOpen={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          onImageSelect={(imageUrl: string) => {
            if (imageUrl) addImage(imageUrl);
            setShowMediaModal(false);
          }}
        />
      )}
    </>
  );
}

interface PostComposersProps {
  post: any;
  state: PostState;
  ctx: PostViewContext;
}

/** Inline edit and reply composers, styled like the main GlassCanvasComposer. */
export function PostComposers({ post, state, ctx }: PostComposersProps) {
  return (
    <>
      <AnimatePresence>
        {state.showEditComposer && <EditComposer key="edit" post={post} state={state} />}
      </AnimatePresence>
      <AnimatePresence>
        {state.showReplyComposer && (
          <ReplyComposer key="reply" post={post} state={state} ctx={ctx} />
        )}
      </AnimatePresence>
    </>
  );
}
