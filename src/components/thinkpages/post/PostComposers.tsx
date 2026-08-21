// src/components/thinkpages/post/PostComposers.tsx
// Inline edit and reply composer components using GlassPlateEditor in compact mode.

"use client";

import { useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Edit, Send, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { GlassPlateEditor, type GlassPlateEditorRef } from "~/components/shared/editor";
import { cn } from "~/lib/utils";

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
  handleSubmitReply: () => void;
  isReplyPending?: boolean;

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
  proxyDiscordUrl,
}: PostComposersProps) {
  const replyEditorRef = useRef<GlassPlateEditorRef>(null);

  const handleReplyChange = useCallback(
    (html: string, rawText: string) => {
      // Use html if rich elements present, otherwise rawText
      setReplyText(html.includes("<") && !html.startsWith("<p></p>") ? html : rawText);
    },
    [setReplyText]
  );

  return (
    <>
      {/* Edit Composer */}
      <AnimatePresence>
        {showEditComposer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 shadow-md backdrop-blur-md"
          >
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 border border-amber-500/30">
                <AvatarImage src={proxyDiscordUrl(post.account.profileImageUrl)} />
                <AvatarFallback className="bg-amber-500/20 text-xs font-bold text-amber-300">
                  {(post.account.displayName ?? "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Edit className="h-3.5 w-3.5" />
                  <span>Editing Post</span>
                </div>
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Edit your post..."
                  className="min-h-[80px] resize-none border-white/10 bg-black/40 text-xs text-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmitEdit();
                    }
                    if (e.key === "Escape") {
                      setShowEditComposer(false);
                    }
                  }}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEditComposer(false)}
                    className="text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitEdit}
                    disabled={!editText.trim() || editText === post.content || isEditPending}
                    className="bg-amber-600 text-xs font-bold text-white hover:bg-amber-500"
                  >
                    {isEditPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Composer */}
      <AnimatePresence>
        {showReplyComposer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-md backdrop-blur-md"
          >
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 border border-white/10">
                <AvatarFallback className="bg-purple-600 text-xs font-bold text-white">
                  You
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <GlassPlateEditor
                  ref={replyEditorRef}
                  value={replyText}
                  onChange={handleReplyChange}
                  onSubmit={handleSubmitReply}
                  submitOnEnter={true}
                  placeholder={`Reply to @${post.account?.username}... (Enter to reply, Shift+Enter for newline)`}
                  disabled={isReplyPending}
                  minHeight={56}
                  maxHeight={180}
                  className="border-white/10 bg-black/40"
                  hideToolbar={true}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Press <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-zinc-300">Enter</kbd> to reply
                  </span>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowReplyComposer(false)}
                      className="text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitReply}
                      disabled={!replyText.trim() || isReplyPending}
                      className={cn(
                        "gap-1 bg-purple-600 text-xs font-bold text-white transition-all hover:bg-purple-500 active:scale-95",
                        isReplyPending && "opacity-60"
                      )}
                    >
                      {isReplyPending ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Replying...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3 w-3" />
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
    </>
  );
}
