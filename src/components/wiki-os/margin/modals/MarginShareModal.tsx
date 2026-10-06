"use client";
// Share modal for WikiOS Margin: Send quotes to direct messages or copy in Markdown, Wikitext, or BBCode.
// Signature Highlighter Yellow / Warm Amber branding for Margin.

import { useState } from "react";
import {
  Check,
  Copy,
  Send,
  ChatBubble as MessageSquare,
  Page as FileText,
  Code,
  ShareAndroid as Share2,
} from "iconoir-react";
import { soundCues } from "~/lib/sound/cuelume";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { publicArticleUrl } from "~/lib/wiki-os/config";

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
      soundCues?.success?.();
      notify.success("Quote sent to message thread");
      setIsSending(false);
      onClose();
    },
    onError: (err) => {
      setIsSending(false);
      notify.error(err.message || "Failed to send message");
    },
  });

  const articleUrl = publicArticleUrl(articleTitle);
  const cleanQuote = quoteText.trim();

  const formats = [
    {
      id: "markdown",
      name: "Markdown",
      icon: FileText,
      description: "For notes, docs, and chat",
      getContent: () =>
        `> "${cleanQuote}"\n\n— *[${articleTitle}](${articleUrl})*${
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
    const formattedMessage = `Quote from [[${articleTitle}]]:\n> "${cleanQuote}"\n\n${articleUrl}`;

    sendMessageMutation.mutate({
      conversationId,
      content: formattedMessage,
    });
  };

  const recentConversations = isAuthenticated
    ? (conversationsData?.conversations?.slice(0, 4) ?? [])
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md gap-4 overflow-y-auto p-5">
        {/* Header */}
        <div className="flex items-center gap-2 pr-10">
          <div className="bg-margin-bg text-margin-accent rounded-row flex size-8 shrink-0 items-center justify-center">
            <Share2 className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-headline">Share and export</DialogTitle>
            <DialogDescription className="text-footnote truncate">{articleTitle}</DialogDescription>
          </div>
        </div>

        {/* Quote snippet preview */}
        <blockquote className="border-margin-accent rounded-row bg-surface-secondary text-footnote text-label-secondary line-clamp-3 border-l-4 p-3 italic">
          &ldquo;{cleanQuote}&rdquo;
        </blockquote>

        <FacetList variant="inset" className="gap-4">
          {/* ThinkShare dispatch */}
          {recentConversations.length > 0 && (
            <FacetListSection header="Send to conversation" headerAs="h4">
              {recentConversations.map((c: any) => {
                const participantName =
                  c.participants
                    ?.map((p: any) => p.user?.wikiUsername || p.user?.discordUsername || "User")
                    .join(", ") || "Conversation";

                return (
                  <FacetRow
                    key={c.id}
                    disabled={isSending}
                    onClick={() => handleDispatchToChat(c.id)}
                    leading={
                      <MessageSquare className="text-margin-accent size-4" aria-hidden="true" />
                    }
                    title={<span className="truncate">{participantName}</span>}
                    trailing={
                      <span className="text-caption text-tint flex items-center gap-1">
                        <Send className="size-3.5" aria-hidden="true" />
                        Send
                      </span>
                    }
                  />
                );
              })}
            </FacetListSection>
          )}

          {/* Copy formats */}
          <FacetListSection header="Copy format" headerAs="h4">
            {formats.map((fmt) => {
              const Icon = fmt.icon;
              const isCopied = copiedFormat === fmt.id;
              return (
                <FacetRow
                  key={fmt.id}
                  onClick={() => handleCopy(fmt.id, fmt.getContent())}
                  leading={<Icon className="text-margin-accent size-4" aria-hidden="true" />}
                  title={fmt.name}
                  subtitle={fmt.description}
                  trailing={
                    isCopied ? (
                      <span className="text-caption text-green flex items-center gap-1">
                        <Check className="size-3.5" aria-hidden="true" />
                        Copied
                      </span>
                    ) : (
                      <span className="text-caption text-label-secondary flex items-center gap-1">
                        <Copy className="size-3.5" aria-hidden="true" />
                        Copy
                      </span>
                    )
                  }
                />
              );
            })}
          </FacetListSection>
        </FacetList>
      </DialogContent>
    </Dialog>
  );
}
