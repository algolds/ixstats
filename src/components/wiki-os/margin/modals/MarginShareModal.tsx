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
          className="relative w-full max-w-md space-y-4 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 p-5 text-[var(--wikios-text)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--wikios-border)] pb-3">
            <div className="flex items-center gap-2">
              <div className="bg-margin-bg border-margin-border text-margin-accent flex h-8 w-8 items-center justify-center rounded-xl border shadow-[0_0_10px_var(--margin-accent-glow)]">
                <Share2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm leading-none font-bold text-[var(--wikios-text)]">
                  Share and export
                </h3>
                <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-[var(--wikios-text-dim)]">
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
              className="cursor-pointer rounded-lg p-1 text-[var(--wikios-text-dim)] transition-all hover:bg-[var(--wikios-border)] hover:text-[var(--wikios-text)] active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quote Snippet Preview */}
          <div className="border-margin-accent line-clamp-3 rounded-xl border border-l-3 border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/80 p-3 text-xs leading-relaxed text-[var(--wikios-text-muted)] italic">
            &ldquo;{cleanQuote}&rdquo;
          </div>

          {/* ThinkShare Dispatch Section */}
          {isAuthenticated && (conversationsData?.conversations?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-[var(--wikios-text-muted)]">
                <span>Send to conversation</span>
                <span className="text-margin-accent text-[10px] font-semibold">Recent chats</span>
              </div>
              <div className="custom-scrollbar max-h-36 space-y-1 overflow-y-auto pr-1">
                {conversationsData?.conversations.slice(0, 4).map((c: any) => {
                  const participantName =
                    c.participants
                      ?.map((p: any) => p.user?.wikiUsername || p.user?.discordUsername || "User")
                      .join(", ") || "Conversation";

                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={isSending}
                      onClick={() => handleDispatchToChat(c.id)}
                      className="hover:bg-margin-bg hover:border-margin-border group flex w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 p-2 text-left text-xs transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare className="text-margin-accent h-3.5 w-3.5 shrink-0" />
                        <span className="group-hover:text-margin-accent truncate font-semibold text-[var(--wikios-text)]">
                          {participantName}
                        </span>
                      </div>
                      <span className="text-margin-accent flex shrink-0 items-center gap-1 text-[10.5px] font-bold transition-transform group-hover:translate-x-0.5">
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
                    className="hover:bg-margin-bg hover:border-margin-border group flex cursor-pointer items-center justify-between rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/60 p-2.5 text-left transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="text-margin-accent group-hover:border-margin-border flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)]">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="group-hover:text-margin-accent text-xs font-bold text-[var(--wikios-text)]">
                          {fmt.name}
                        </div>
                        <div className="text-[10px] text-[var(--wikios-text-dim)]">
                          {fmt.description}
                        </div>
                      </div>
                    </div>

                    <div className="group-hover:text-margin-accent flex items-center gap-1 text-xs text-[var(--wikios-text-dim)]">
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
