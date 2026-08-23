"use client";

import { motion, AnimatePresence } from "motion/react";
import { Trash as Trash2, WhiteFlag as Flag, OpenNewWindow as ExternalLink, Copy, Xmark as X } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { ReactionsDialog } from "../ReactionsDialog";

export interface PostModalsProps {
  post: any;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (val: boolean) => void;
  handleConfirmDelete: () => void;
  isDeletePending?: boolean;

  showFlagDialog: boolean;
  setShowFlagDialog: (val: boolean) => void;
  flagReason: string;
  setFlagReason: (val: string) => void;
  handleSubmitFlag: () => void;
  isFlagPending?: boolean;

  showReactionsDialog: boolean;
  setShowReactionsDialog: (val: boolean) => void;
  onAccountClick?: (accountId: string) => void;

  lightboxMedia: { id: string; url: string } | null;
  setLightboxMedia: (val: { id: string; url: string } | null) => void;
  notify: any;
}

export function PostModals({
  post,
  showDeleteConfirm,
  setShowDeleteConfirm,
  handleConfirmDelete,
  isDeletePending,
  showFlagDialog,
  setShowFlagDialog,
  flagReason,
  setFlagReason,
  handleSubmitFlag,
  isFlagPending,
  showReactionsDialog,
  setShowReactionsDialog,
  onAccountClick,
  lightboxMedia,
  setLightboxMedia,
  notify,
}: PostModalsProps) {
  return (
    <>
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md border border-white/10 bg-slate-900/95 p-6 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-rose-500/20 p-2 text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white">Delete Post</h3>
              <p className="text-xs text-slate-400">This action cannot be undone.</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeletePending}
              className="text-xs font-bold"
            >
              {isDeletePending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Flag / Report Dialog */}
      <Dialog
        open={showFlagDialog}
        onOpenChange={(open) => {
          setShowFlagDialog(open);
          if (!open) setFlagReason("");
        }}
      >
        <DialogContent className="max-w-md border border-white/10 bg-slate-900/95 p-6 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/20 p-2 text-amber-400">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white">Report Post</h3>
              <p className="text-xs text-slate-400">Help us understand what is wrong.</p>
            </div>
          </div>
          <Textarea
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Why are you flagging this post?"
            className="mt-4 border-white/10 bg-black/40 text-xs text-white placeholder:text-slate-500"
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowFlagDialog(false);
                setFlagReason("");
              }}
              className="text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitFlag}
              disabled={!flagReason.trim() || isFlagPending}
              className="bg-amber-600 text-xs font-bold text-white hover:bg-amber-500"
            >
              {isFlagPending ? "Flagging..." : "Report Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reactions Detail Dialog */}
      <ReactionsDialog
        postId={post.id}
        isOpen={showReactionsDialog}
        onClose={() => setShowReactionsDialog(false)}
        onAccountClick={onAccountClick}
        discordMsgId={(() => {
          const match = post.content?.match(/\[DiscordMsg:(\d+)\]/);
          return match ? match[1] : null;
        })()}
      />

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100100] flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            onClick={() => setLightboxMedia(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 flex max-w-[85vw] flex-col items-center gap-4 sm:max-w-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-3xl border border-white/20 bg-white/[0.03] p-2 shadow-2xl backdrop-blur-xl">
                <motion.img
                  layoutId={lightboxMedia.id}
                  src={lightboxMedia.url}
                  alt="Expanded view"
                  className="max-h-[65vh] w-full rounded-2xl object-contain"
                />
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/50 p-1.5 backdrop-blur-xl">
                <button
                  onClick={() => window.open(lightboxMedia.url, "_blank")}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 active:scale-95"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Original
                </button>
                <div className="h-4 w-px bg-white/10" />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(lightboxMedia.url);
                    notify.success("Image URL copied to clipboard!");
                  }}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Link
                </button>
                <div className="h-4 w-px bg-white/10" />
                <button
                  onClick={() => setLightboxMedia(null)}
                  className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 active:scale-95"
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
