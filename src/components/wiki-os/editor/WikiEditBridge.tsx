"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import {
  saveDraft,
  getDraft,
  clearDraft,
} from "~/lib/wiki-os/editor/draft-store";
import { wikitextToAst, astToHtml } from "~/lib/wiki-os/transformers/wiki-ast-converter";

const WikiVisualEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiVisualEditor").then((m) => m.WikiVisualEditor),
  { loading: () => <EditorLoading text="Loading visual editor..." />, ssr: false }
);

const WikiSourceEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiSourceEditor").then((m) => m.WikiSourceEditor),
  { loading: () => <EditorLoading text="Loading source editor..." />, ssr: false }
);

function EditorLoading({ text = "Loading editor..." }: { text?: string }) {
  return (
    <div className="wikios-loading flex min-h-[400px] flex-col items-center justify-center">
      <div className="wikios-loading-spinner" />
      <p className="mt-4 text-sm text-zinc-400">{text}</p>
    </div>
  );
}

interface WikiEditBridgeProps {
  title: string;
  initialMode?: "source" | "visual";
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export function WikiEditBridge({
  title,
  initialMode = "source",
  onClose,
  onSaveSuccess,
}: WikiEditBridgeProps) {
  const [mode, setMode] = useState<"source" | "visual">(initialMode);
  const [_saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [editConflict, setEditConflict] = useState(false);
  const [activeHtml, setActiveHtml] = useState<string | null>(null);
  const [activeWikitext, setActiveWikitext] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const {
    data: editorHtml,
    isLoading: editorLoading,
    refetch: refetchEditorHtml,
  } = api.wikios.getEditorHtml.useQuery(
    { title },
    { enabled: mode === "visual", staleTime: 5 * 60 * 1000 }
  );

  const {
    data: wikitextData,
    isLoading: wtLoading,
    refetch: refetchWikitext,
  } = api.wikios.getWikitext.useQuery(
    { title },
    { enabled: mode === "source", staleTime: 5 * 60 * 1000 }
  );

  const convertWikitextToHtml = api.wikios.convertWikitextToHtml.useMutation();
  const htmlToWikitext = api.wikios.htmlToWikitext.useMutation();
  const saveArticle = api.wikios.saveArticle.useMutation();
  const saveWikitext = api.wikios.saveWikitext.useMutation();

  // Restore draft from canonical draft store
  useEffect(() => {
    const localDraft = getDraft(title);
    if (localDraft && !draftRestored) {
      if (localDraft.mode === "visual" && localDraft.html) {
        setActiveHtml(localDraft.html);
        setMode("visual");
      } else if (localDraft.wikitext) {
        setActiveWikitext(localDraft.wikitext);
        setMode("source");
      }
      setDraftRestored(true);
    }
  }, [title, draftRestored]);

  const handleModeSwitch = useCallback(
    async (newMode: "source" | "visual", dirty: boolean, currentContent: string) => {
      if (newMode === mode) return;

      if (dirty) {
        setConverting(true);
        try {
          if (newMode === "visual") {
            // Instant client-side path: convert wikitext → AST → HTML when the
            // document is fully within our grammar; fall back to Parsoid otherwise.
            let handled = false;
            try {
              const doc = wikitextToAst(currentContent, title);
              if (doc.parseConfidence === "full") {
                setActiveHtml(astToHtml(doc));
                saveDraft({
                  title,
                  source: "ixwiki",
                  mode: "visual",
                  html: astToHtml(doc),
                });
                handled = true;
              }
            } catch {
              /* fall through to server conversion */
            }
            if (!handled) {
              const res = await convertWikitextToHtml.mutateAsync({
                wikitext: currentContent,
                title,
              });
              setActiveHtml(res.html);
              saveDraft({
                title,
                source: "ixwiki",
                mode: "visual",
                html: res.html,
              });
            }
            setMode(newMode);
          } else {
            const res = await htmlToWikitext.mutateAsync({
              html: currentContent,
              title,
            });
            setActiveWikitext(res.wikitext);
            saveDraft({
              title,
              source: "ixwiki",
              mode: "source",
              wikitext: res.wikitext,
            });
          }
          setMode(newMode);
        } catch (err) {
          console.error("Seamless mode switch failed:", err);
        } finally {
          setConverting(false);
        }
      } else {
        setMode(newMode);
      }
    },
    [mode, title, convertWikitextToHtml, htmlToWikitext]
  );

  const handleVisualSave = useCallback(
    async (html: string, summary: string, minor: boolean, keepEditing?: boolean) => {
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

        if ((result as { editConflict?: boolean }).editConflict) {
          setEditConflict(true);
          throw new Error("Edit conflict detected: this page was modified by another user.");
        }

        clearDraft(title);

        if (keepEditing) {
          const res = await refetchEditorHtml();
          if (res.data) {
            setActiveHtml(res.data.html);
          }
        } else {
          onSaveSuccess?.();
          onClose();
        }
      } catch (err) {
        console.error("Failed to save article:", err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [title, editorHtml, saveArticle, refetchEditorHtml, onSaveSuccess, onClose]
  );

  const handleSourceSave = useCallback(
    async (wikitext: string, summary: string, minor: boolean, keepEditing?: boolean) => {
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

        if ((result as { editConflict?: boolean }).editConflict) {
          setEditConflict(true);
          throw new Error("Edit conflict detected: this page was modified by another user.");
        }

        clearDraft(title);

        if (keepEditing) {
          const res = await refetchWikitext();
          if (res.data) {
            setActiveWikitext(res.data.wikitext);
          }
        } else {
          onSaveSuccess?.();
          onClose();
        }
      } catch (err) {
        console.error("Failed to save wikitext:", err);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [title, wikitextData, saveWikitext, refetchWikitext, onSaveSuccess, onClose]
  );

  const isLoading = (mode === "visual" ? editorLoading : wtLoading) || converting;

  if (isLoading) {
    return <EditorLoading text={converting ? "Converting editor mode..." : "Loading article..."} />;
  }

  return (
    <div className="wikios-edit-bridge relative min-h-[600px] w-full">
      {editConflict && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <strong>Edit Conflict Detected:</strong> Someone else modified this page since you opened
          it. Please review your edits before saving.
        </div>
      )}

      {mode === "visual" ? (
        <WikiVisualEditor
          title={title}
          initialHtml={activeHtml ?? editorHtml?.html ?? ""}
          onSave={handleVisualSave}
          onCancel={onClose}
          onSwitchToSource={(dirty, html) => handleModeSwitch("source", dirty, html)}
        />
      ) : (
        <WikiSourceEditor
          title={title}
          initialWikitext={activeWikitext ?? wikitextData?.wikitext ?? ""}
          onSave={handleSourceSave}
          onCancel={onClose}
          onSwitchToVisual={(dirty, wt) => handleModeSwitch("visual", dirty, wt)}
        />
      )}
    </div>
  );
}
