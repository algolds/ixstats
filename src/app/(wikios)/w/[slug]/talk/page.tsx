// src/app/(wikios)/w/[slug]/talk/page.tsx
// WikiOS Talk Page — discussion/collaboration page for an article
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { MessageSquare, Clock, Plus, ArrowLeft } from "lucide-react";

interface Comment {
  id: string;
  author: string;
  timestamp: string;
  content: string;
  level: number;
  sectionIndex: number;
}

interface Section {
  index: number;
  title: string;
  id: string;
  comments: Comment[];
}

// ---------------------------------------------------------------------------
// CommentCard Component
// ---------------------------------------------------------------------------
function CommentCard({
  comment,
  sectionTitle,
  onQuote,
  onReply,
}: {
  comment: Comment;
  sectionTitle: string;
  onQuote: (html: string) => void;
  onReply: () => void;
}) {
  const { data: authorData } = api.users.resolveWikiAuthor.useQuery(
    { wikiUsername: comment.author },
    { staleTime: 10 * 60 * 1000, enabled: !!comment.author }
  );

  const indentStyle = {
    marginLeft: `${Math.min(comment.level * 20, 120)}px`,
  };

  const roleBadge = authorData?.role ? (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase border leading-none shrink-0",
        authorData.role.name === "system-owner" || authorData.role.name === "admin"
          ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
          : "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
      )}
    >
      {authorData.role.displayName}
    </span>
  ) : null;

  const countryBadge = authorData?.country ? (
    <Link
      href={withBasePath(`/countries/${authorData.country.id}`)}
      className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-white transition-colors bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg shrink-0"
    >
      {authorData.country.flag && (
        <img
          src={authorData.country.flag}
          alt=""
          className="h-2.5 w-3.5 object-cover rounded-sm"
          referrerPolicy="no-referrer"
        />
      )}
      <span>{authorData.country.name}</span>
    </Link>
  ) : null;

  return (
    <div
      style={indentStyle}
      className="relative pl-4 mb-4 border-l border-white/5 hover:border-blue-500/20 transition-all duration-300"
    >
      {/* Visual Thread Nesting Connector */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-white/5" />

      <div className="glass-surface glass-refraction p-4 rounded-2xl border border-white/5 bg-white/[0.01] shadow-lg flex flex-col gap-2.5">
        {/* Header: Author, Role, Country, Timestamp */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-200">{comment.author}</span>
            {roleBadge}
            {countryBadge}
          </div>
          <div className="text-zinc-500 text-[10px] font-medium">{comment.timestamp}</div>
        </div>

        {/* Comment Body */}
        <div
          className="text-sm text-zinc-300 leading-relaxed font-sans wikios-comment-body"
          dangerouslySetInnerHTML={{ __html: comment.content }}
        />

        {/* Actions: Quote, Reply */}
        <div className="flex items-center justify-end gap-4 mt-1 text-[10px] font-bold text-zinc-500">
          <button
            onClick={() => onQuote(comment.content)}
            className="hover:text-blue-400 transition-colors cursor-pointer select-none"
            type="button"
          >
            Quote
          </button>
          <button
            onClick={onReply}
            className="hover:text-emerald-400 transition-colors cursor-pointer select-none"
            type="button"
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HTML Thread Parser
// ---------------------------------------------------------------------------
function parseTalkHtml(html: string): { sections: Section[] } {
  if (typeof window === "undefined") return { sections: [] };
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  const parsedSections: Section[] = [];
  let currentSection: Section | null = null;
  let sectionIndex = 0;

  function extractSignature(element: HTMLElement): { author: string; date: string; contentHtml: string } {
    let author = "Anonymous";
    let date = "";
    let contentHtml = element.innerHTML;

    // Try to find User links
    const links = Array.from(element.querySelectorAll("a"));
    const userLink = links.find(l => {
      const href = l.getAttribute("href") || "";
      return href.includes("User:") || href.includes("User_talk:") || href.includes("User%3A");
    });

    if (userLink) {
      const href = userLink.getAttribute("href") || "";
      const match = href.match(/User:(.+)$/) || href.match(/User%3A(.+?)(?:[&#]|$)/);
      author = match ? decodeURIComponent(match[1]!).replace(/_/g, " ") : userLink.textContent || "Anonymous";
      author = author.split("/")[0]!;
    }

    // Try to find standard signature timestamp e.g. 12:34, 9 June 2026 (UTC)
    const text = element.textContent || "";
    const dateRegex = /(\d{2}:\d{2},\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+\(UTC\))/;
    const dateMatch = text.match(dateRegex);
    
    if (dateMatch) {
      date = dateMatch[1]!;
      contentHtml = contentHtml.replace(date, "");
      
      if (userLink) {
        contentHtml = contentHtml.replace(userLink.outerHTML, "");
      }
      
      contentHtml = contentHtml.replace(/\s*\(talk\)\s*$/, "")
                               .replace(/\s*-\s*$/, "")
                               .replace(/--\s*$/, "")
                               .trim();
    }

    return { author, date, contentHtml };
  }

  function visit(node: Node, depth: number) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      if (tagName === "h2") {
        const headingText = el.textContent?.replace(/\[edit\]/i, "").trim() || `Section ${sectionIndex + 1}`;
        currentSection = {
          index: sectionIndex++,
          title: headingText,
          id: `section-${sectionIndex}`,
          comments: []
        };
        parsedSections.push(currentSection);
        return;
      }

      if (tagName === "p" || tagName === "dd" || tagName === "li") {
        const text = el.textContent || "";
        const hasSig = text.includes("(UTC)") || text.match(/\d{2}:\d{2}/);
        
        if (hasSig && text.trim().length > 5) {
          if (!currentSection) {
            currentSection = {
              index: sectionIndex++,
              title: "General Discussion",
              id: `section-${sectionIndex}`,
              comments: []
            };
            parsedSections.push(currentSection);
          }
          const sig = extractSignature(el);
          currentSection.comments.push({
            id: Math.random().toString(36).substring(2, 9),
            author: sig.author,
            timestamp: sig.date,
            content: sig.contentHtml,
            level: Math.max(0, depth - 1),
            sectionIndex: currentSection.index
          });
          return;
        }
      }

      if (tagName === "dl" || tagName === "ul" || tagName === "ol") {
        const children = Array.from(el.childNodes);
        for (const child of children) {
          visit(child, depth + 1);
        }
        return;
      }
    }

    const children = Array.from(node.childNodes);
    for (const child of children) {
      visit(child, depth);
    }
  }

  const children = Array.from(body.childNodes);
  for (const child of children) {
    visit(child, 0);
  }

  return { sections: parsedSections };
}

// ---------------------------------------------------------------------------
// Main TalkPage Component
// ---------------------------------------------------------------------------
export default function TalkPage() {
  const params = useParams<{ slug: string }>();
  const title = decodeURIComponent(params.slug).replace(/_/g, " ");
  const talkTitle = `Talk:${title}`;

  const { data, isLoading, refetch } = api.wikios.getTalkPage.useQuery(
    { title },
    { staleTime: 30_000 }
  );

  const { data: sectionsData } = api.wikios.getTalkSections.useQuery(
    { title },
    { staleTime: 30_000 }
  );

  const [showNewSection, setShowNewSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionContent, setSectionContent] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ index: number; title: string } | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const addSectionMutation = api.wikios.addTalkSection.useMutation({
    onSuccess: () => {
      setShowNewSection(false);
      setSectionTitle("");
      setSectionContent("");
      void refetch();
    },
  });

  const replyMutation = api.wikios.replyToTalkSection.useMutation({
    onSuccess: () => {
      setReplyTarget(null);
      setReplyContent("");
      void refetch();
    },
  });

  // Parse threaded comments on the client
  const parsedData = useMemo(() => {
    if (!data?.contentHtml) return { sections: [] };
    return parseTalkHtml(data.contentHtml);
  }, [data?.contentHtml]);

  const tocEntries = useMemo(() => {
    return parsedData.sections.map((sec) => ({
      id: sec.id,
      name: sec.title,
      level: 2,
    }));
  }, [parsedData.sections]);

  const handleQuote = (html: string, secIndex: number, secTitle: string) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const text = temp.textContent || temp.innerText || "";
    setReplyContent(`<blockquote>${text.trim()}</blockquote>\n\n`);
    setReplyTarget({ index: secIndex, title: secTitle });
  };

  const talkUrl = `/w/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  return (
    <WikiOSLayout title={talkTitle} sections={tocEntries}>
      <div className="wikios-special-page mx-auto max-w-4xl py-6">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href={withBasePath(talkUrl)}
              className="wikios-action-btn flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3"
            >
              <ArrowLeft size={14} />
              <span>Back to Article</span>
            </Link>
            <Link
              href={withBasePath(`/w/special/history/${encodeURIComponent(talkTitle.replace(/ /g, "_"))}`)}
              className="wikios-action-btn flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3"
            >
              <Clock size={14} />
              <span>Talk History</span>
            </Link>
          </div>
          <button
            className="wikios-editor-btn-primary flex items-center gap-1.5 text-xs font-bold py-1.5 px-3"
            onClick={() => {
              setReplyTarget(null);
              setShowNewSection(true);
            }}
          >
            <Plus size={14} />
            <span>New Section</span>
          </button>
        </div>

        {/* New section form */}
        {showNewSection && (
          <div className="mb-6 p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-md">
            <h3 className="text-sm font-bold text-blue-400 mb-3">New Discussion Section</h3>
            <input
              type="text"
              placeholder="Section title"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl mb-3 bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-blue-500/40"
            />
            <textarea
              placeholder="Your message (wikitext supported)..."
              value={sectionContent}
              onChange={(e) => setSectionContent(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 rounded-xl mb-3 bg-white/5 border border-white/10 text-white text-sm font-mono outline-none resize-vertical focus:border-blue-500/40"
            />
            <div className="flex gap-2">
              <button
                className="wikios-editor-btn-primary text-xs"
                disabled={!sectionTitle.trim() || !sectionContent.trim() || addSectionMutation.isPending}
                onClick={() =>
                  addSectionMutation.mutate({ title, sectionTitle, content: sectionContent })
                }
              >
                {addSectionMutation.isPending ? "Posting..." : "Post Section"}
              </button>
              <button
                className="wikios-action-btn text-xs"
                onClick={() => setShowNewSection(false)}
              >
                Cancel
              </button>
            </div>
            {addSectionMutation.isError && (
              <p className="text-rose-400 text-xs mt-3">
                Error: {addSectionMutation.error.message}
              </p>
            )}
          </div>
        )}

        {/* Reply form */}
        {replyTarget && (
          <div className="mb-6 p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-md">
            <h3 className="text-sm font-bold text-emerald-400 mb-3">Replying to: {replyTarget.title}</h3>
            <textarea
              placeholder="Your reply (wikitext supported)..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-xl mb-3 bg-white/5 border border-white/10 text-white text-sm font-mono outline-none resize-vertical focus:border-emerald-500/40"
            />
            <div className="flex gap-2">
              <button
                className="wikios-editor-btn-primary text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={!replyContent.trim() || replyMutation.isPending}
                onClick={() =>
                  replyMutation.mutate({
                    title,
                    sectionIndex: replyTarget.index,
                    content: replyContent,
                  })
                }
              >
                {replyMutation.isPending ? "Posting..." : "Post Reply"}
              </button>
              <button
                className="wikios-action-btn text-xs"
                onClick={() => setReplyTarget(null)}
              >
                Cancel
              </button>
            </div>
            {replyMutation.isError && (
              <p className="text-rose-400 text-xs mt-3">
                Error: {replyMutation.error.message}
              </p>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="wikios-loading min-h-60">
            <div className="wikios-loading-spinner" />
          </div>
        )}

        {/* Threaded comments rendering */}
        {!isLoading && parsedData.sections.length > 0 && (
          <div className="space-y-8">
            {parsedData.sections.map((sec) => (
              <div key={sec.id} id={sec.id} className="scroll-mt-20">
                {/* Section Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-4">
                  <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <MessageSquare size={16} className="text-purple-400" />
                    <span>{sec.title}</span>
                  </h2>
                  <button
                    className="wikios-action-btn text-[11px] font-bold py-1 px-2.5 rounded-lg border border-white/5 bg-white/5 text-zinc-300 hover:text-white"
                    onClick={() => setReplyTarget({ index: sec.index, title: sec.title })}
                  >
                    Reply Section
                  </button>
                </div>

                {/* Section comments */}
                {sec.comments.length > 0 ? (
                  <div className="space-y-1 pl-1">
                    {sec.comments.map((comment) => (
                      <CommentCard
                        key={comment.id}
                        comment={comment}
                        sectionTitle={sec.title}
                        onQuote={(html) => handleQuote(html, sec.index, sec.title)}
                        onReply={() => setReplyTarget({ index: sec.index, title: sec.title })}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic pl-6 mb-4">
                    No comments in this section yet.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Fallback if wikitext cannot be structured */}
        {!isLoading && data?.exists && parsedData.sections.length === 0 && data.contentHtml && (
          <div
            className="wikios-article-body"
            dangerouslySetInnerHTML={{ __html: data.contentHtml }}
          />
        )}

        {/* Empty talk page */}
        {!isLoading && data && !data.exists && (
          <div className="text-center py-16 text-zinc-500">
            <MessageSquare size={36} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-sm font-semibold mb-1">No discussion yet for this article</p>
            <p className="text-xs">Click &ldquo;New Section&rdquo; above to start the discussion.</p>
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
