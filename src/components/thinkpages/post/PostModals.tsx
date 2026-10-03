"use client";

import { motion } from "motion/react";
import {
  Trash as Trash2,
  WhiteFlag as Flag,
  OpenNewWindow as ExternalLink,
  Copy,
  Xmark as X,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ReactionsDialog } from "../ReactionsDialog";
import type { PostState } from "./postViewTypes";

interface PostModalsProps {
  post: any;
  state: PostState;
  onAccountClick?: (accountId: string) => void;
}

export function PostModals({ post, state, onAccountClick }: PostModalsProps) {
  const {
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleConfirmDelete,
    deletePostMutation,
    showFlagDialog,
    setShowFlagDialog,
    flagReason,
    setFlagReason,
    handleSubmitFlag,
    flagPostMutation,
    showReactionsDialog,
    setShowReactionsDialog,
    lightboxMedia,
    setLightboxMedia,
    notify,
  } = state;
  const isDeletePending = deletePostMutation.isPending;
  const isFlagPending = flagPostMutation.isPending;

  return (
    <>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletePending}
              onClick={(event) => {
                // Stay open while the delete runs; the handler closes it on success.
                event.preventDefault();
                handleConfirmDelete();
              }}
            >
              <Trash2 aria-hidden="true" />
              {isDeletePending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={showFlagDialog}
        onOpenChange={(open) => {
          setShowFlagDialog(open);
          if (!open) setFlagReason("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="text-warning size-5" aria-hidden="true" />
              Report post
            </DialogTitle>
            <DialogDescription>Help us understand what is wrong.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Why are you flagging this post?"
            aria-label="Reason for reporting"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowFlagDialog(false);
                setFlagReason("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitFlag} disabled={!flagReason.trim() || isFlagPending}>
              {isFlagPending ? "Flagging..." : "Report post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReactionsDialog
        postId={post.id}
        isOpen={showReactionsDialog}
        onClose={() => setShowReactionsDialog(false)}
        onAccountClick={onAccountClick}
        discordMsgId={post.content?.match(/\[DiscordMsg:(\d+)\]/)?.[1] ?? null}
      />

      {/* Lightbox — instant presentation: the shared-element (layoutId) motion is the transition */}
      <Dialog open={!!lightboxMedia} onOpenChange={(open) => !open && setLightboxMedia(null)}>
        {lightboxMedia && (
          <DialogContent
            presentation="instant"
            showCloseButton={false}
            aria-describedby={undefined}
            className="flex w-auto max-w-[85vw] flex-col items-center gap-4 border-0 bg-transparent p-0 shadow-none sm:max-w-xl"
          >
            <DialogTitle className="sr-only">Image</DialogTitle>
            <div className="bg-surface rounded-card shadow-sheet p-2">
              <motion.img
                layoutId={lightboxMedia.id}
                src={lightboxMedia.url}
                alt="Expanded view"
                className="rounded-row max-h-[65vh] w-full object-contain"
              />
            </div>

            <div className="bg-surface-elevated border-separator rounded-card shadow-floating flex items-center gap-1 border p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(lightboxMedia.url, "_blank")}
              >
                <ExternalLink aria-hidden="true" />
                Open original
              </Button>
              <div className="bg-separator h-4 w-px" aria-hidden="true" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(lightboxMedia.url);
                  notify.success("Image URL copied to clipboard");
                }}
              >
                <Copy aria-hidden="true" />
                Copy link
              </Button>
              <div className="bg-separator h-4 w-px" aria-hidden="true" />
              <Button variant="secondary" size="sm" onClick={() => setLightboxMedia(null)}>
                <X aria-hidden="true" />
                Close
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
