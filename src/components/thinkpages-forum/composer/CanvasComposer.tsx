"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Reply, SendDiagonal } from "iconoir-react";
import type { TSlateEditor } from "platejs";
import { ActionPicker } from "~/components/action-links";
import { useAttachPrefill } from "~/components/action-links/useAttachPrefill";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import type { WikitextSerializeResult } from "~/components/wiki-os/editor/plate/wiki-wikitext";
import type { ForumReward } from "~/lib/action-rewards";
import { cn } from "~/lib/utils/cn";
import type { PostStyle } from "../thread/types";
import { insertAtCaret } from "./canvas-ops";
import { PersonaSelect, type PersonaOption } from "./PersonaSelect";
import type { QuoteRequest } from "./QuoteInsert";
import { CanvasPreviewPane } from "./CanvasPreviewPane";
import { FORMATTING_LATER } from "./canvas-copy";
import { RewardSignal } from "./RewardSignal";
import { useCanvasPreview } from "./useCanvasPreview";
import { useCanvasQuote } from "./useCanvasQuote";
import { useCanvasSend } from "./useCanvasSend";

// The Canvas editor, hosted bare: its toolbar, slash menu and modals, without the page title bar or save menu.
const WikiVisualEditor = dynamic(
  () => import("~/components/wiki-os/editor/WikiVisualEditor").then((m) => m.WikiVisualEditor),
  { loading: () => <Skeleton className="rounded-control h-40" />, ssr: false }
);

const NOOP = () => undefined;
const VIEWS = [
  { value: "write", label: "Write" },
  { value: "preview", label: "Preview" },
] as const;

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
  /**
   * Saves the post. Reject with the server's message to have it shown; a reply or thread is cleared on success. The
   * result's `reward` (credits the post earned for linking an action) shows as a success Signal until the next edit.
   */
  onSubmit: (
    wikitext: string,
    meta: CanvasSubmitMeta
  ) => Promise<{ formatting: "done" | "pending"; reward?: ForumReward | null }>;
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
  const [seed, setSeed] = useState(initialWikitext);
  const [editorKey, setEditorKey] = useState(0);
  const [doc, setDoc] = useState<WikitextSerializeResult>({
    wikitext: initialWikitext,
    complete: true,
    notices: [],
  });
  const [title, setTitle] = useState("");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const { view, preview, changeView } = useCanvasPreview(doc.wikitext, threadId);

  const editorRef = useRef<TSlateEditor | null>(null);
  // The last wikitext the editor reported: a Signal about the previous save goes when the content differs from it.
  const lastTextRef = useRef(initialWikitext);
  const onWikitextChangeRef = useRef(onWikitextChange);
  onWikitextChangeRef.current = onWikitextChange;

  const save = useCallback(
    () => onSubmit(doc.wikitext, { personaId, title: title.trim() }),
    [onSubmit, doc.wikitext, personaId, title]
  );
  // A posted reply or thread starts the next one blank (its report of "" is not an edit).
  const startBlank = useCallback(() => {
    lastTextRef.current = "";
    setSeed("");
    setDoc({ wikitext: "", complete: true, notices: [] });
    onWikitextChangeRef.current?.("");
    setTitle("");
    setEditorKey((k) => k + 1);
  }, []);
  const { phase, reward, settle, send } = useCanvasSend(save, mode !== "edit", startBlank);

  const sending = phase.kind === "sending";
  const hasText = doc.wikitext.trim().length > 0;
  const canSubmit =
    hasText && doc.complete && !sending && (mode !== "thread" || title.trim().length > 0);

  const handleEditorReady = useCanvasQuote(editorRef, quoteRequest, onQuoteInserted);

  const handleSerialized = useCallback(
    (next: WikitextSerializeResult) => {
      setDoc(next);
      if (next.wikitext !== lastTextRef.current) {
        lastTextRef.current = next.wikitext;
        settle();
      }
      onWikitextChangeRef.current?.(next.wikitext);
    },
    [settle]
  );

  const attach = useCallback((token: string) => {
    if (editorRef.current) insertAtCaret(editorRef.current, token);
  }, []);

  // A share from MyCountry opens a new thread with its action already attached. insertAtCaret selects the end of the
  // draft first, so the token is in as soon as it returns.
  useAttachPrefill(
    mode === "thread"
      ? (token) => {
          if (!editorRef.current) return false;
          insertAtCaret(editorRef.current, token);
          return true;
        }
      : null
  );

  const submit = () => {
    if (canSubmit) void send();
  };

  return (
    <Card
      content="input"
      padding="md"
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
        <div className="flex items-center gap-3">
          {/* The inline reply box names itself; the phone sheet has its own title. */}
          {mode === "reply" && !fill ? (
            <CardTitle icon={<Reply />} role="heading" aria-level={2}>
              Reply
            </CardTitle>
          ) : null}
          <SegmentedControl
            size="sm"
            aria-label="Editor view"
            options={VIEWS}
            value={view}
            onValueChange={(v) => void changeView(v)}
          />
        </div>
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
        className="forum-canvas facet-well rounded-row ring-separator focus-within:ring-tint overflow-hidden ring-1 transition-shadow"
      >
        <WikiVisualEditor
          key={editorKey}
          bare
          compactToolbar
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

      {view === "preview" ? <CanvasPreviewPane preview={preview} postStyle={postStyle} /> : null}

      {!doc.complete ? (
        <Signal tone="warning" title="Part of this post cannot be saved yet">
          Something in it has no wikitext form. Remove or retype it to continue.
        </Signal>
      ) : null}
      {phase.kind === "error" ? <Signal tone="destructive" title={phase.message} /> : null}
      {phase.kind === "pending" ? <Signal tone="info" title={FORMATTING_LATER} /> : null}
      <RewardSignal reward={reward} />

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
          className="pointer-coarse:min-h-11"
          onClick={submit}
          disabled={!canSubmit}
        >
          {mode === "edit" ? null : <SendDiagonal aria-hidden />}
          {SUBMIT_LABEL[mode]}
        </Button>
      </div>
    </Card>
  );
}
