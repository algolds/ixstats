// src/app/(wikios)/w/[slug]/edit/page.tsx
// WikiOS Article Editor — Visual (Parsoid HTML contenteditable) + Source (CodeMirror)
// Includes edit conflict detection via basetimestamp
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import { withBasePath } from "~/lib/base-path";

const WikiVisualEditor = dynamic(
  () => import("~/components/wikios/editor/WikiVisualEditor").then((m) => m.WikiVisualEditor),
  { loading: () => <EditorLoading />, ssr: false }
);

const WikiSourceEditor = dynamic(
  () => import("~/components/wikios/editor/WikiSourceEditor").then((m) => m.WikiSourceEditor),
  { loading: () => <EditorLoading />, ssr: false }
);

function EditorLoading() {
  return (
    <div className="wikios-loading" style={{ minHeight: 400 }}>
      <div className="wikios-loading-spinner" />
      <p className="mt-4 text-sm text-zinc-400">Loading editor...</p>
    </div>
  );
}

type EditorMode = "visual" | "source";

export default function WikiOSEditPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  let title: string;
  try {
    title = decodeURIComponent(slug).replace(/_/g, " ");
  } catch {
    title = slug.replace(/_/g, " ");
  }

  const [mode, setMode] = useState<EditorMode>("source");
  const [saving, setSaving] = useState(false);
  const [editConflict, setEditConflict] = useState(false);

  const switchMode = useCallback(
    (newMode: EditorMode) => {
      if (newMode === mode) return;
      const confirmed = window.confirm(
        "Switching editor mode will discard any unsaved changes. Continue?"
      );
      if (confirmed) setMode(newMode);
    },
    [mode]
  );

  // Fetch Parsoid HTML for visual editor (raw, with data-mw attributes)
  const { data: editorHtml, isLoading: editorLoading } = api.wikios.getEditorHtml.useQuery(
    { title },
    { enabled: !!title && mode === "visual", staleTime: 5 * 60 * 1000 }
  );

  // Fetch wikitext for source editor
  const {
    data: wikitextData,
    isLoading: wtLoading,
    refetch: refetchWikitext,
  } = api.wikios.getWikitext.useQuery(
    { title },
    { enabled: !!title && mode === "source", staleTime: 5 * 60 * 1000 }
  );

  const saveArticle = api.wikios.saveArticle.useMutation();
  const saveWikitext = api.wikios.saveWikitext.useMutation();

  const articleUrl = withBasePath(`/w/${encodeURIComponent(title.replace(/ /g, "_"))}`);

  const handleCancel = useCallback(() => {
    router.push(articleUrl);
  }, [router, articleUrl]);

  const handleVisualSave = useCallback(
    async (html: string, summary: string, minor: boolean) => {
      setSaving(true);
      setEditConflict(false);
      try {
        const result = await saveArticle.mutateAsync({
          title,
          html,
          summary,
          minor,
          basetimestamp: editorHtml?.timestamp ?? undefined,
        });
        if (result.editConflict) {
          setEditConflict(true);
          return;
        }
        router.push(articleUrl);
      } catch (err) {
        console.error("Save failed:", err);
        alert("Save failed. Try the source editor instead.");
      } finally {
        setSaving(false);
      }
    },
    [saveArticle, title, router, articleUrl, editorHtml?.timestamp]
  );

  const handleSourceSave = useCallback(
    async (wikitext: string, summary: string, minor: boolean) => {
      setSaving(true);
      setEditConflict(false);
      try {
        const result = await saveWikitext.mutateAsync({
          title,
          wikitext,
          summary,
          minor,
          basetimestamp: wikitextData?.timestamp ?? undefined,
        });
        if (result.editConflict) {
          setEditConflict(true);
          return;
        }
        router.push(articleUrl);
      } catch (err) {
        console.error("Save failed:", err);
        alert("Save failed. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [saveWikitext, title, router, articleUrl, wikitextData?.timestamp]
  );

  const isLoading = mode === "visual" ? editorLoading : wtLoading;

  // Edit conflict banner
  const conflictBanner = editConflict && (
    <div
      style={{
        margin: "12px 0",
        padding: "12px 16px",
        borderRadius: 10,
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.3)",
        fontSize: "0.875rem",
        color: "#fca5a5",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 6, color: "#f87171" }}>Edit conflict detected</p>
      <p style={{ marginBottom: 8 }}>
        Someone else edited this page while you were working. Your changes have not been saved.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className="wikios-action-btn"
          style={{
            background: "rgba(251,191,36,0.12)",
            borderColor: "rgba(251,191,36,0.3)",
            color: "#fbbf24",
            fontSize: "0.8125rem",
          }}
          onClick={() => {
            // Force save (overwrite)
            setEditConflict(false);
            // Save without basetimestamp to force overwrite
            if (mode === "source") {
              setSaving(true);
              saveWikitext
                .mutateAsync({
                  title,
                  wikitext: wikitextData?.wikitext ?? "",
                  summary: "Overwriting edit conflict",
                  minor: false,
                })
                .then(() => router.push(articleUrl))
                .catch(() => alert("Save failed."))
                .finally(() => setSaving(false));
            }
          }}
        >
          Overwrite with my version
        </button>
        <button
          className="wikios-action-btn"
          style={{ fontSize: "0.8125rem" }}
          onClick={() => {
            setEditConflict(false);
            void refetchWikitext();
          }}
        >
          Reload latest version (discard my changes)
        </button>
        <button
          className="wikios-action-btn"
          style={{ fontSize: "0.8125rem" }}
          onClick={() => {
            // Open diff in new tab to compare
            window.open(
              withBasePath(`/w/special/history/${encodeURIComponent(title.replace(/ /g, "_"))}`),
              "_blank"
            );
          }}
        >
          View history
        </button>
      </div>
    </div>
  );

  // Visual editor is full-page immersive (no sidebar wrapper)
  if (mode === "visual") {
    return (
      <>
        {saving && (
          <div className="wikios-editor-saving">
            <div className="wikios-loading-spinner" />
            <span>Saving...</span>
          </div>
        )}
        {conflictBanner}
        {isLoading && <EditorLoading />}
        {!isLoading && editorHtml && (
          <WikiVisualEditor
            initialHtml={editorHtml.html}
            title={title}
            onSave={handleVisualSave}
            onCancel={handleCancel}
            onSwitchToSource={() => switchMode("source")}
          />
        )}
      </>
    );
  }

  // Source editor uses WikiOSLayout
  return (
    <WikiOSLayout>
      <div className="wikios-editor-page">
        {saving && (
          <div className="wikios-editor-saving">
            <div className="wikios-loading-spinner" />
            <span>Saving...</span>
          </div>
        )}
        {conflictBanner}
        {isLoading && <EditorLoading />}
        {!isLoading && wikitextData && (
          <WikiSourceEditor
            initialWikitext={wikitextData.wikitext}
            title={title}
            onSave={handleSourceSave}
            onCancel={handleCancel}
            onSwitchToVisual={() => switchMode("visual")}
          />
        )}
      </div>
    </WikiOSLayout>
  );
}
