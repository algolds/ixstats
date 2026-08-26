// src/components/wiki-os/margin/modals/MarginShareModal.tsx
// Share modal for WikiOS Margin: Send quotes to direct messages or copy in Markdown, Wikitext, or BBCode.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Xmark as X,
  Check,
  Copy,
  Send,
  ChatBubble as MessageSquare,
  Page as FileText,
  Code,
  ShareAndroid as Share2,
} from "iconoir-react";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

interface MarginShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleTitle: string;
  quoteText: string;
  commentNote?: string | null;
  isAuthenticated: boolean;
}

export function MarginShareModal({
  isOpen,
  onClose,
  articleTitle,
  quoteText,
  commentNote,
  isAuthenticated,
}: MarginShareModalProps) {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const notify = useNotify();

  // Query recent ThinkShare conversations if authenticated
  const { data: conversationsData } = api.messages.getConversationsByFolder.useQuery(
    { folder: "inbox" },
    {
      enabled: isOpen && isAuthenticated,
      staleTime: 30_000,
    }
  );

  const sendMessageMutation = api.messages.sendMessage.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Quote sent to message thread");
      setIsSending(false);
      onClose();
    },
    onError: (err) => {
      setIsSending(false);
      notify.error(err.message || "Failed to send message");
    },
  });

  const slug = encodeURIComponent(articleTitle.replace(/ /g, "_"));
  const cleanQuote = quoteText.trim();

  const formats = [
    {
      id: "markdown",
      name: "Markdown",
      icon: FileText,
      description: "For notes, docs, and chat",
      getContent: () =>
        `> "${cleanQuote}"\n\n— *[${articleTitle}](https://ixwiki.com/wiki/${slug})*${
          commentNote ? `\n> *Significance: ${commentNote}*` : ""
        }`,
    },
    {
      id: "wikitext",
      name: "Wikitext",
      icon: Code,
      description: "Template with quote and link",
      getContent: () =>
        `{{quote|text=${cleanQuote}|author=[[${articleTitle}]]${
          commentNote ? `|significance=${commentNote}` : ""
        }}}`,
    },
    {
      id: "bbcode",
      name: "Forum BBCode",
      icon: MessageSquare,
      description: "For forum posts and replies",
      getContent: () =>
        `[QUOTE="${articleTitle}"]${cleanQuote}[/QUOTE]${
          commentNote ? `\n[I]Significance: ${commentNote}[/I]` : ""
        }`,
    },
  ];

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      soundEffects.press();
      setCopiedFormat(id);
      notify.success("Copied to clipboard");
      setTimeout(() => setCopiedFormat(null), 1500);
    } catch {
      notify.error("Failed to copy to clipboard");
    }
  };

  const handleDispatchToChat = (conversationId: string) => {
    if (isSending) return;
    setIsSending(true);
    soundEffects.press();
    const formattedMessage = `Quote from [[${articleTitle}]]:\n> "${cleanQuote}"\n\nhttps://ixwiki.com/wiki/${slug}`;

    sendMessageMutation.mutate({
      conversationId,
      content: formattedMessage,
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            soundEffects.release();
            onClose();
          }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.7 }}
          className="relative w-full max-w-md rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl text-[var(--wikios-text)] space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--wikios-border)] pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-margin-bg border border-margin-border text-margin-accent shadow-[0_0_10px_var(--margin-accent-glow)]">
                <Share2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-none text-[var(--wikios-text)]">
                  Share and export
                </h3>
                <p className="text-[11px] text-[var(--wikios-text-dim)] truncate max-w-[260px] mt-0.5">
                  {articleTitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEffects.release();
                onClose();
              }}
              className="rounded-lg p-1 text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-[var(--wikios-border)] active:scale-95 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quote Snippet Preview */}
          <div className="rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-3 text-xs italic text-[var(--wikios-text-muted)] line-clamp-3 leading-relaxed border-l-3 border-margin-accent">
            &ldquo;{cleanQuote}&rdquo;
          </div>

          {/* ThinkShare Dispatch Section */}
          {isAuthenticated && (conversationsData?.conversations?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-[var(--wikios-text-muted)]">
                <span>Send to conversation</span>
                <span className="text-[10px] text-margin-accent font-semibold">Recent chats</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {conversationsData?.conversations.slice(0, 4).map((c: any) => {
                  const participantName =
                    c.participants?.map((p: any) => p.user?.wikiUsername || p.user?.discordUsername || "User").join(", ") ||
                    "Conversation";

                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={isSending}
                      onClick={() => handleDispatchToChat(c.id)}
                      className="w-full flex items-center justify-between p-2 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 hover:bg-margin-bg hover:border-margin-border text-left active:scale-[0.98] transition-all cursor-pointer text-xs group"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare className="h-3.5 w-3.5 text-margin-accent shrink-0" />
                        <span className="font-semibold text-[var(--wikios-text)] group-hover:text-margin-accent truncate">
                          {participantName}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[10.5px] font-bold text-margin-accent group-hover:translate-x-0.5 transition-transform shrink-0">
                        <Send className="h-3 w-3" />
                        <span>Send</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Copy Formatting Grid */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-[var(--wikios-text-muted)]">
              Copy format
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {formats.map((fmt) => {
                const Icon = fmt.icon;
                const isCopied = copiedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => handleCopy(fmt.id, fmt.getContent())}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 hover:bg-margin-bg hover:border-margin-border active:scale-[0.98] transition-all cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--wikios-surface)] border border-[var(--wikios-border)] text-margin-accent group-hover:border-margin-border">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--wikios-text)] group-hover:text-margin-accent">
                          {fmt.name}
                        </div>
                        <div className="text-[10px] text-[var(--wikios-text-dim)]">
                          {fmt.description}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-[var(--wikios-text-dim)] group-hover:text-margin-accent">
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[10.5px] font-bold text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span className="text-[10.5px] font-semibold">Copy</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
