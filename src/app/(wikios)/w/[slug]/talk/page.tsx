// src/app/(wikios)/w/[slug]/talk/page.tsx
// WikiOS Talk Page — discussion/collaboration page for an article
"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";

export default function TalkPage() {
  const params = useParams<{ slug: string }>();
  const title = decodeURIComponent(params.slug).replace(/_/g, " ");

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

  const sections = sectionsData?.sections ?? [];

  return (
    <WikiOSLayout title={`Talk: ${title}`}>
      <div className="wikios-special-page">
        {/* Navigation */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <Link
            href={withBasePath(`/w/${encodeURIComponent(title.replace(/ /g, "_"))}`)}
            className="wikios-action-btn"
            style={{ fontSize: "0.8125rem" }}
          >
            &larr; Article
          </Link>
          <Link
            href={withBasePath(`/wiki-special/history/${encodeURIComponent(`Talk:${title.replace(/ /g, "_")}`)}`)}
            className="wikios-action-btn"
            style={{ fontSize: "0.8125rem" }}
          >
            Talk history
          </Link>
          <button
            className="wikios-action-btn"
            style={{
              fontSize: "0.8125rem",
              background: "rgba(59,130,246,0.12)",
              borderColor: "rgba(59,130,246,0.3)",
              color: "#60a5fa",
            }}
            onClick={() => setShowNewSection(true)}
          >
            + New Section
          </button>
        </div>

        {/* New section form */}
        {showNewSection && (
          <div
            style={{
              marginBottom: 20, padding: "16px", borderRadius: 10,
              background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: 10, color: "#93c5fd" }}>
              New Discussion Section
            </h3>
            <input
              type="text"
              placeholder="Section title"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6, marginBottom: 8,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "inherit", fontSize: "0.875rem",
              }}
            />
            <textarea
              placeholder="Your message (wikitext supported)..."
              value={sectionContent}
              onChange={(e) => setSectionContent(e.target.value)}
              rows={5}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6, marginBottom: 8,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "inherit", fontSize: "0.875rem", fontFamily: "monospace", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="wikios-action-btn"
                style={{ background: "rgba(59,130,246,0.15)", borderColor: "rgba(59,130,246,0.3)", color: "#60a5fa" }}
                disabled={!sectionTitle.trim() || !sectionContent.trim() || addSectionMutation.isPending}
                onClick={() => addSectionMutation.mutate({ title, sectionTitle, content: sectionContent })}
              >
                {addSectionMutation.isPending ? "Posting..." : "Post Section"}
              </button>
              <button className="wikios-action-btn" onClick={() => setShowNewSection(false)}>
                Cancel
              </button>
            </div>
            {addSectionMutation.isError && (
              <p style={{ color: "#f87171", marginTop: 8, fontSize: "0.8125rem" }}>
                Error: {addSectionMutation.error.message}
              </p>
            )}
          </div>
        )}

        {/* Reply form */}
        {replyTarget && (
          <div
            style={{
              marginBottom: 20, padding: "16px", borderRadius: 10,
              background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: 10, color: "#86efac" }}>
              Replying to: {replyTarget.title}
            </h3>
            <textarea
              placeholder="Your reply (wikitext supported)..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={4}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6, marginBottom: 8,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "inherit", fontSize: "0.875rem", fontFamily: "monospace", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="wikios-action-btn"
                style={{ background: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)", color: "#4ade80" }}
                disabled={!replyContent.trim() || replyMutation.isPending}
                onClick={() =>
                  replyMutation.mutate({ title, sectionIndex: replyTarget.index, content: replyContent })
                }
              >
                {replyMutation.isPending ? "Posting..." : "Post Reply"}
              </button>
              <button className="wikios-action-btn" onClick={() => setReplyTarget(null)}>
                Cancel
              </button>
            </div>
            {replyMutation.isError && (
              <p style={{ color: "#f87171", marginTop: 8, fontSize: "0.8125rem" }}>
                Error: {replyMutation.error.message}
              </p>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="wikios-loading" style={{ minHeight: 200 }}>
            <div className="wikios-loading-spinner" />
          </div>
        )}

        {/* Talk page content */}
        {data?.exists && data.contentHtml && (
          <div>
            {/* Section reply buttons */}
            {sections.length > 0 && (
              <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sections.map((s) => (
                  <button
                    key={s.index}
                    className="wikios-action-btn"
                    style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                    onClick={() => setReplyTarget({ index: s.index, title: s.title })}
                    title={`Reply to "${s.title}"`}
                  >
                    Reply: {s.title.length > 30 ? `${s.title.slice(0, 30)}...` : s.title}
                  </button>
                ))}
              </div>
            )}

            {/* Rendered talk page HTML */}
            <div
              className="wikios-article-body"
              dangerouslySetInnerHTML={{ __html: data.contentHtml }}
            />
          </div>
        )}

        {/* Empty talk page */}
        {data && !data.exists && (
          <div
            style={{
              textAlign: "center", padding: "40px 20px",
              color: "var(--wikios-text-muted, #71717a)",
            }}
          >
            <p style={{ fontSize: "1rem", marginBottom: 8 }}>
              No discussion yet for this article.
            </p>
            <p style={{ fontSize: "0.875rem" }}>
              Click &ldquo;+ New Section&rdquo; above to start a discussion.
            </p>
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
