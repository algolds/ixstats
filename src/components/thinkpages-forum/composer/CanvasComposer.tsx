"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { TSlateEditor } from "platejs";
import { ActionPicker } from "~/components/action-links";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import type { WikitextSerializeResult } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import { cn } from "~/lib/utils/cn";
import { api } from "~/trpc/react";
import { PostBody } from "../thread/PostBody";
import type { PostStyle } from "../thread/types";
import { appendQuote, insertAtCaret } from "./canvas-ops";
import { PersonaSelect, type PersonaOption } from "./PersonaSelect";
import type { QuoteRequest } from "./QuoteInsert";

// The Canvas editor, hosted bare: its toolbar, slash menu and modals, without the page title bar or save menu.
const WikiVisualEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiVisualEditor").then((m) => m.WikiVisualEditor),
  { loading: () => <Skeleton className="rounded-control h-40" />, ssr: false }
);

const NOOP = () => undefined;
const FORMATTING_LATER = "Formatting will finish shortly";
const VIEWS = [
  { value: "write", label: "Write" },
  { value: "preview", label: "Preview" },
] as const;

type View = (typeof VIEWS)[number]["value"];
type Phase =
  { kind: "idle" } | { kind: "sending" } | { kind: "pending" } | { kind: "error"; message: string };
type Preview =
  | { kind: "loading" }
  | { kind: "ready"; html: string; pending: boolean }
  | { kind: "error"; message: string };

const SUBMIT_LABEL = { reply: "Reply", thread: "Post thread", edit: "Save" } as const;

export interface CanvasSubmitMeta {
  personaId: string | null;
  title: string;
}

export interface CanvasComposerProps {
  mode: "reply" | "thread" | "edit";
  /** The post's wikitext to start from (edit), or a draft to reopen on. */
  initialWikitext?: string;
  /** The thread the post is for: the preview renders as it would in that thread. */
  threadId?: string;
  /** Saves the post. Reject with the server's message to have it shown; a reply or thread is cleared on success. */
  onSubmit: (
    wikitext: string,
    meta: CanvasSubmitMeta
  ) => Promise<{ formatting: "done" | "pending" }>;
  /** The member's personas for "Posting as"; omit where in-character posting is not allowed. */
  personas?: readonly PersonaOption[];
  /** A quote to add to the draft (a new object each time the Quote button is pressed). */
  quoteRequest?: QuoteRequest | null;
  /** Called once the quote is in the draft, so the host can forget it. */
  onQuoteInserted?: () => void;
  /** Reports the draft's wikitext after every change (a host that unmounts the composer keeps it). */
  onWikitextChange?: (wikitext: string) => void;
  /** How the post reads in the preview. */
  postStyle?: PostStyle;
  /** A taller editing area (the phone sheet). */
  fill?: boolean;
  className?: string;
}

/**
 * The forum's Canvas composer: the WikiOS rich-text editor for a new thread, a reply or an edit, saved as wikitext.
 * Write / Preview (a server render, nothing saved), Attach action, the persona switcher, and the save's outcome as a
 * Signal: the server's message when it refuses, "Formatting will finish shortly" when the wiki was busy.
 */
export function CanvasComposer({
  mode,
  initialWikitext = "",
  threadId,
  onSubmit,
  personas = [],
  quoteRequest = null,
  onQuoteInserted,
  onWikitextChange,
  postStyle = "ooc",
  fill = false,
  className,
}: CanvasComposerProps) {
  const [view, setView] = useState<View>("write");
  const [seed, setSeed] = useState(initialWikitext);
  const [editorKey, setEditorKey] = useState(0);
  const [doc, setDoc] = useState<WikitextSerializeResult>({
    wikitext: initialWikitext,
    complete: true,
    notices: [],
  });
  const [title, setTitle] = useState("");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [preview, setPreview] = useState<Preview | null>(null);
  const { mutateAsync: previewPost } = api.thinkpagesForum.previewPost.useMutation();

  const editorRef = useRef<TSlateEditor | null>(null);
  // The last wikitext the editor reported: a Signal about the previous save goes when the content differs from it.
  const lastTextRef = useRef(initialWikitext);
  const quotedRef = useRef<QuoteRequest | null>(null);
  const onQuoteInsertedRef = useRef(onQuoteInserted);
  onQuoteInsertedRef.current = onQuoteInserted;
  const onWikitextChangeRef = useRef(onWikitextChange);
  onWikitextChangeRef.current = onWikitextChange;

  const sending = phase.kind === "sending";
  const hasText = doc.wikitext.trim().length > 0;
  const canSubmit =
    hasText && doc.complete && !sending && (mode !== "thread" || title.trim().length > 0);

  const applyQuote = useCallback((quote: QuoteRequest) => {
    if (!editorRef.current || quotedRef.current === quote) return;
    quotedRef.current = quote;
    appendQuote(editorRef.current, quote);
    onQuoteInsertedRef.current?.();
  }, []);

  // The quote may arrive before the editor has loaded (a phone sheet that has just opened): it waits for it.
  const handleEditorReady = useCallback(
    (editor: TSlateEditor) => {
      editorRef.current = editor;
      if (quoteRequest) applyQuote(quoteRequest);
    },
    [quoteRequest, applyQuote]
  );
  useEffect(() => {
    if (quoteRequest) applyQuote(quoteRequest);
  }, [quoteRequest, applyQuote]);

  const handleSerialized = useCallback((next: WikitextSerializeResult) => {
    setDoc(next);
    if (next.wikitext !== lastTextRef.current) {
      lastTextRef.current = next.wikitext;
      // An edit makes the last save's outcome (a refusal, "formatting") stale.
      setPhase((current) => (current.kind === "sending" ? current : { kind: "idle" }));
    }
    onWikitextChangeRef.current?.(next.wikitext);
  }, []);

  const attach = useCallback((token: string) => {
    if (editorRef.current) insertAtCaret(editorRef.current, token);
  }, []);

  const changeView = useCallback(
    async (next: View) => {
      setView(next);
      if (next !== "preview") return;
      setPreview({ kind: "loading" });
      try {
        const out = await previewPost({ wikitext: doc.wikitext, threadId });
        setPreview({ kind: "ready", html: out.html, pending: out.pending });
      } catch (e) {
        setPreview({
          kind: "error",
          message: e instanceof Error ? e.message : "Could not preview",
        });
      }
    },
    [previewPost, doc.wikitext, threadId]
  );

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setPhase({ kind: "sending" });
    try {
      const { formatting } = await onSubmit(doc.wikitext, { personaId, title: title.trim() });
      setPhase(formatting === "pending" ? { kind: "pending" } : { kind: "idle" });
      if (mode !== "edit") {
        // A posted reply or thread starts the next one blank (its report of "" is not an edit).
        lastTextRef.current = "";
        setSeed("");
        setDoc({ wikitext: "", complete: true, notices: [] });
        onWikitextChangeRef.current?.("");
        setTitle("");
        setEditorKey((k) => k + 1);
      }
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Could not post" });
    }
  }, [canSubmit, onSubmit, doc.wikitext, personaId, title, mode]);

  return (
    <Card
      content="input"
      padding="sm"
      data-slot="canvas-composer"
      className={cn("flex flex-col gap-3", className)}
    >
      {mode === "thread" ? (
        <Input
          placeholder="Thread title"
          aria-label="Thread title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={sending}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          size="sm"
          aria-label="Editor view"
          options={VIEWS}
          value={view}
          onValueChange={(v) => void changeView(v)}
        />
        {view === "write" ? (
          <div inert={sending}>
            <ActionPicker onPick={attach} />
          </div>
        ) : null}
      </div>

      <div
        hidden={view !== "write"}
        data-fill={fill ? "" : undefined}
        // What is typed while the post is being sent would be lost when the editor clears.
        inert={sending}
        className="forum-canvas rounded-row overflow-hidden"
      >
        <WikiVisualEditor
          key={editorKey}
          bare
          title="ThinkPages post"
          initialWikitext={seed}
          restoreLocalDraft={false}
          onSave={NOOP}
          onCancel={NOOP}
          onSwitchToSource={NOOP}
          onSerializedWikitext={handleSerialized}
          onEditorReady={handleEditorReady}
        />
      </div>

      {view === "preview" ? (
        <div aria-live="polite" className="min-h-24 px-1">
          {preview?.kind === "ready" ? (
            <>
              {preview.pending ? (
                <Signal tone="info" title={FORMATTING_LATER} className="mb-3">
                  The wiki is busy, so this preview is approximate.
                </Signal>
              ) : null}
              <PostBody html={preview.html} style={postStyle} />
            </>
          ) : null}
          {preview?.kind === "error" ? <Signal tone="destructive" title={preview.message} /> : null}
          {preview?.kind === "loading" ? (
            <Skeleton aria-busy="true" className="h-24 w-full" />
          ) : null}
        </div>
      ) : null}

      {!doc.complete ? (
        <Signal tone="warning" title="Part of this post cannot be saved yet">
          Something in it has no wikitext form. Remove or retype it to continue.
        </Signal>
      ) : null}
      {phase.kind === "error" ? <Signal tone="destructive" title={phase.message} /> : null}
      {phase.kind === "pending" ? <Signal tone="info" title={FORMATTING_LATER} /> : null}

      <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        {personas.length > 0 && mode !== "edit" ? (
          <PersonaSelect
            label="Posting as"
            personas={personas}
            value={personaId}
            onChange={setPersonaId}
            disabled={sending}
          />
        ) : (
          <span />
        )}
        <Button
          type="button"
          size="sm"
          className="pointer-coarse:min-h-11"
          onClick={() => void submit()}
          disabled={!canSubmit}
        >
          {SUBMIT_LABEL[mode]}
        </Button>
      </div>
    </Card>
  );
}
