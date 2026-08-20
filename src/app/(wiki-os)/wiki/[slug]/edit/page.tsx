// src/app/(wiki-os)/wiki/[slug]/edit/page.tsx
// WikiOS Article Editor — Visual (Parsoid HTML contenteditable) + Source (CodeMirror)
// Includes edit conflict detection via basetimestamp
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { withBasePath } from "~/lib/base-path";

const WikiVisualEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiVisualEditor").then((m) => m.WikiVisualEditor),
  { loading: () => <EditorLoading />, ssr: false }
);

const WikiSourceEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiSourceEditor").then((m) => m.WikiSourceEditor),
  { loading: () => <EditorLoading />, ssr: false }
);

function EditorLoading({ text = "Loading editor..." }: { text?: string }) {
  return (
    <div className="wikios-loading" style={{ minHeight: 400 }}>
      <div className="wikios-loading-spinner" />
      <p className="mt-4 text-sm text-zinc-400">{text}</p>
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
  const [modeSynced, setModeSynced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [editConflict, setEditConflict] = useState(false);

  const [activeHtml, setActiveHtml] = useState<string | null>(null);
  const [activeWikitext, setActiveWikitext] = useState<string | null>(null);

  // Fetch Parsoid HTML for visual editor (raw, with data-mw attributes)
  const {
    data: editorHtml,
    isLoading: editorLoading,
    refetch: refetchEditorHtml,
  } = api.wikios.getEditorHtml.useQuery(
    { title },
    { enabled: !!title && mode === "visual" && modeSynced, staleTime: 5 * 60 * 1000 }
  );

  // Fetch wikitext for source editor
  const {
    data: wikitextData,
    isLoading: wtLoading,
    refetch: refetchWikitext,
  } = api.wikios.getWikitext.useQuery(
    { title },
    { enabled: !!title && mode === "source" && modeSynced, staleTime: 5 * 60 * 1000 }
  );

  const isLoading = !modeSynced || (mode === "visual" ? editorLoading : wtLoading);

  // Sync mode with URL query parameter or localStorage preference on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let m = params.get("mode");
    if (m !== "visual" && m !== "source") {
      const pref = localStorage.getItem("wikios:preferredEditor");
      if (pref === "visual" || pref === "source") {
        m = pref;
      }
    }
    if (m === "visual" || m === "source") {
      setMode(m);
      if (params.get("mode") !== m) {
        params.set("mode", m);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, "", newUrl);
      }
    } else {
      const htmlDraft = localStorage.getItem(`wikios-draft-html-${title}`);
      const wtDraft = localStorage.getItem(`wikios-draft-${title}`);
      if (htmlDraft && !wtDraft) {
        setMode("visual");
        params.set("mode", "visual");
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, "", newUrl);
      }
    }
    setModeSynced(true);
  }, [title]);

  useEffect(() => {
    if (editorHtml?.html && activeHtml === null) {
      setActiveHtml(editorHtml.html);
    }
  }, [editorHtml, activeHtml]);

  useEffect(() => {
    if (wikitextData?.wikitext && activeWikitext === null) {
      setActiveWikitext(wikitextData.wikitext);
    }
  }, [wikitextData, activeWikitext]);

  const convertWikitextToHtml = api.wikios.convertWikitextToHtml.useMutation();
  const convertHtmlToWikitext = api.wikios.htmlToWikitext.useMutation();

  const [prefillLoaded, setPrefillLoaded] = useState(false);

  useEffect(() => {
    if (isLoading || prefillLoaded) return;

    const isNewPage =
      (mode === "source" && wikitextData && wikitextData.wikitext === "") ||
      (mode === "visual" && editorHtml && editorHtml.html === "");

    if (!isNewPage) {
      setPrefillLoaded(true);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("prefill");

    if (prefill) {
      const decodedPrefill = decodeURIComponent(prefill);
      if (mode === "source") {
        setActiveWikitext(decodedPrefill);
        setPrefillLoaded(true);
      } else if (mode === "visual") {
        setConverting(true);
        convertWikitextToHtml
          .mutateAsync({ wikitext: decodedPrefill, title })
          .then((res) => {
            setActiveHtml(res.html);
            setPrefillLoaded(true);
          })
          .catch((err) => {
            console.error("Failed to convert prefill wikitext to HTML:", err);
            setMode("source");
            setActiveWikitext(decodedPrefill);
            setPrefillLoaded(true);
          })
          .finally(() => {
            setConverting(false);
          });
      }
    } else {
      setPrefillLoaded(true);
    }
  }, [isLoading, mode, title, wikitextData, editorHtml, convertWikitextToHtml, prefillLoaded]);

  const switchMode = useCallback(
    async (newMode: EditorMode, dirty: boolean, currentContent: string) => {
      if (newMode === mode) return;

      if (dirty) {
        setConverting(true);
        try {
          if (newMode === "visual") {
            const res = await convertWikitextToHtml.mutateAsync({
              wikitext: currentContent,
              title,
            });
            setActiveHtml(res.html);
            localStorage.setItem(`wikios-draft-html-${title}`, res.html);
            localStorage.removeItem(`wikios-draft-${title}`);
          } else {
            const res = await convertHtmlToWikitext.mutateAsync({
              html: currentContent,
              title,
            });
            setActiveWikitext(res.wikitext);
            localStorage.setItem(`wikios-draft-${title}`, res.wikitext);
            localStorage.removeItem(`wikios-draft-html-${title}`);
          }
          setMode(newMode);
        } catch (err) {
          console.error("Seamless mode switch failed:", err);
          alert("Failed to convert layout automatically. Switching will discard changes.");
        } finally {
          setConverting(false);
        }
      } else {
        if (newMode === "visual") {
          setActiveHtml(null);
        } else {
          setActiveWikitext(null);
        }
        setMode(newMode);
      }

      // Sync URL query param
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") !== newMode) {
        params.set("mode", newMode);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, "", newUrl);
      }
    },
    [mode, title, convertWikitextToHtml, convertHtmlToWikitext]
  );

  const saveArticle = api.wikios.saveArticle.useMutation();
  const saveWikitext = api.wikios.saveWikitext.useMutation();

  const articleUrl = withBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`);

  const handleCancel = useCallback(() => {
    router.push(articleUrl);
  }, [router, articleUrl]);

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
        if (result.editConflict) {
          setEditConflict(true);
          return;
        }
        if (keepEditing) {
          const res = await refetchEditorHtml();
          if (res.data) {
            setActiveHtml(res.data.html);
          }
        } else {
          router.push(articleUrl);
        }
      } catch (err) {
        console.error("Save failed:", err);
        alert("Save failed. Try the source editor instead.");
      } finally {
        setSaving(false);
      }
    },
    [saveArticle, title, router, articleUrl, editorHtml?.timestamp, refetchEditorHtml]
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
        if (result.editConflict) {
          setEditConflict(true);
          return;
        }
        if (keepEditing) {
          const res = await refetchWikitext();
          if (res.data) {
            setActiveWikitext(res.data.wikitext);
          }
        } else {
          router.push(articleUrl);
        }
      } catch (err) {
        console.error("Save failed:", err);
        alert("Save failed. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [saveWikitext, title, router, articleUrl, wikitextData?.timestamp, refetchWikitext]
  );

  // Edit conflict banner
  const conflictBanner = editConflict && (
    <div className="my-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-red-300 backdrop-blur-sm">
      <p className="text-destructive mb-1.5 font-semibold">Edit conflict detected</p>
      <p className="mb-2">
        Someone else edited this page while you were working. Your changes have not been saved.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="wikios-action-btn border-amber-500/40 bg-amber-500/20 text-xs text-amber-400 hover:bg-amber-500/30 active:scale-95"
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
          className="wikios-action-btn text-xs active:scale-95"
          onClick={() => {
            setEditConflict(false);
            void refetchWikitext();
          }}
        >
          Reload latest version (discard my changes)
        </button>
        <button
          className="wikios-action-btn text-xs active:scale-95"
          onClick={() => {
            // Open diff in new tab to compare
            window.open(
              withBasePath(`/wiki/history/${encodeURIComponent(title.replace(/ /g, "_"))}`),
              "_blank"
            );
          }}
        >
          View history
        </button>
      </div>
    </div>
  );

  if (converting) {
    return (
      <WikiOSLayout title={title} hideTitleHeading={true}>
        <div className="wikios-editor-page w-full">
          <EditorLoading text="Converting document layout..." />
        </div>
      </WikiOSLayout>
    );
  }

  // Visual editor mode wrapped in WikiOSLayout
  if (mode === "visual") {
    return (
      <WikiOSLayout title={title} hideTitleHeading={true}>
        <div className="wikios-editor-page w-full">
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
              initialHtml={activeHtml ?? editorHtml.html}
              title={title}
              onSave={handleVisualSave}
              onCancel={handleCancel}
              onSwitchToSource={(dirty, currentHtml) => switchMode("source", dirty, currentHtml)}
            />
          )}
        </div>
      </WikiOSLayout>
    );
  }

  // Source editor mode wrapped in WikiOSLayout
  return (
    <WikiOSLayout title={title} hideTitleHeading={true}>
      <div className="wikios-editor-page w-full">
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
            initialWikitext={activeWikitext ?? wikitextData.wikitext}
            title={title}
            onSave={handleSourceSave}
            onCancel={handleCancel}
            onSwitchToVisual={(dirty, currentWikitext) =>
              switchMode("visual", dirty, currentWikitext)
            }
          />
        )}
      </div>
    </WikiOSLayout>
  );
}
