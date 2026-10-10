"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import { Reply, Xmark } from "iconoir-react";
import { ActionPicker } from "~/components/action-links";
import type { GlassPlateEditorRef } from "~/components/shared/editor";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { getBasePath } from "~/lib/base-path";
import { BOARD_MESSAGE_MAX, BOARD_TOO_LONG, slowModeNotice } from "~/lib/thinkpages-forum/board";
import { hasImageSrc } from "~/lib/thinkpages-forum/html-urls";
import { cn } from "~/lib/utils/cn";
import { BanNotice, NoticeText } from "../BanNotice";
import { PersonaSelect, useMyPersonas } from "../composer/PersonaSelect";
import type { BoardAccess, BoardQuote, ReplyTarget } from "./types";
import { retryAfterSecondsOf, useSlowMode } from "./useSlowMode";

const GlassPlateEditor = dynamic(
  () => import("~/components/shared/editor/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  { loading: () => <Skeleton className="rounded-control h-20" />, ssr: false }
);

/** Elements that handle their own focus; a mouse down on them must not be redirected. */
const OWN_FOCUS = "input, textarea, select, button, a, [contenteditable='true'], [role='combobox']";

export interface BoardPostInput {
  html: string;
  personaId: string | null;
  replyToPostId: string | null;
}

interface BoardComposerProps {
  realmName: string;
  access: BoardAccess;
  /** The realm's slow mode, which starts counting after your own post (moderators are exempt). */
  slowModeSeconds: number;
  replyTo: ReplyTarget | null;
  onClearReply: () => void;
  /** A quote to put into the editor. */
  quote: BoardQuote | null;
  onQuoteInserted: () => void;
  /** The member is typing as `personaId` (null for themself); the live hook throttles what it sends. */
  onTyping: (personaId: string | null) => void;
  /** Posts the message; rejects with the server's refusal. */
  onSubmit: (input: BoardPostInput) => Promise<void>;
}

/** Why the viewer cannot post, in place of the composer: a ban with its appeal, else the server's notice. */
function CannotPost({ access }: { access: BoardAccess }) {
  const notice = access.notice ?? "You cannot post on this board.";
  if (access.reason === "banned") return <BanNotice notice={notice} />;
  return (
    <Card variant="well" padding="sm" content="signal">
      <p className="text-callout text-label-secondary">
        <NoticeText notice={notice} />
      </p>
    </Card>
  );
}

function PostingComposer({
  realmName,
  access,
  slowModeSeconds,
  replyTo,
  onClearReply,
  quote,
  onQuoteInserted,
  onTyping,
  onSubmit,
}: BoardComposerProps) {
  const editorRef = useRef<GlassPlateEditorRef>(null);
  const [html, setHtml] = useState("");
  const [plain, setPlain] = useState("");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const personas = useMyPersonas(true);
  const slow = useSlowMode();
  const handledQuote = useRef<number | null>(null);
  const refocus = useRef(false);

  // The editor is read-only while a post is sent, which drops its focus: take it back once it is writable again.
  useEffect(() => {
    if (pending || !refocus.current) return;
    refocus.current = false;
    editorRef.current?.focusEnd();
  }, [pending]);

  const focusEditor = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    // Portaled popovers (persona list, action picker) bubble through React but sit outside the surface.
    if (!event.currentTarget.contains(target) || target.closest(OWN_FOCUS)) return;
    event.preventDefault();
    editorRef.current?.focusEnd();
  }, []);

  const insertText = useCallback((text: string) => {
    editorRef.current?.focusEnd();
    editorRef.current?.insertText(text);
    // The popover returns focus to its trigger on close; take it back so typing continues.
    requestAnimationFrame(() => editorRef.current?.focusEnd());
  }, []);

  useEffect(() => {
    if (!quote || handledQuote.current === quote.key) return;
    handledQuote.current = quote.key;
    insertText(quote.text);
    onQuoteInserted();
  }, [quote, insertText, onQuoteInserted]);

  const replyingTo = replyTo?.postId ?? null;
  useEffect(() => {
    if (replyingTo) editorRef.current?.focusEnd();
  }, [replyingTo]);

  const count = [...plain].length;
  const tooLong = count > BOARD_MESSAGE_MAX;
  // An image counts as content, as it does on the server (prepareBody).
  const hasBody = plain.trim().length > 0 || hasImageSrc(html, getBasePath());
  const canSubmit = hasBody && !tooLong && !pending && slow.remaining === 0;

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit({ html, personaId, replyToPostId: replyingTo });
      editorRef.current?.clear();
      setHtml("");
      setPlain("");
      onClearReply();
      if (!access.isModerator && slowModeSeconds > 0) slow.start(slowModeSeconds);
    } catch (e) {
      const wait = e instanceof Error ? retryAfterSecondsOf(e) : null;
      if (wait) slow.start(wait);
      else setError(e instanceof Error ? e.message : "Could not post");
    } finally {
      refocus.current = true;
      setPending(false);
    }
  };

  return (
    <Card
      variant="well"
      padding="sm"
      content="input"
      data-slot="board-composer"
      className="flex cursor-text flex-col gap-2"
      onMouseDown={focusEditor}
    >
      {replyTo ? (
        <div className="text-footnote text-label-secondary flex items-center gap-2">
          <Reply aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{`Replying to ${replyTo.authorName}`}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cancel reply"
            className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            onClick={onClearReply}
          >
            <Xmark aria-hidden />
          </Button>
        </div>
      ) : null}

      <GlassPlateEditor
        ref={editorRef}
        value={html}
        onChange={(nextHtml, nextPlain) => {
          setHtml(nextHtml);
          setPlain(nextPlain);
          if (nextPlain.trim()) onTyping(personaId);
        }}
        placeholder={`Say something to ${realmName}`}
        allowImageInsert
        disabled={pending}
        minHeight={64}
        maxHeight={240}
        className="border-transparent bg-transparent shadow-none"
      />

      {error ? <Signal tone="destructive" title={error} /> : null}
      {tooLong ? <p className="text-footnote text-label-secondary">{BOARD_TOO_LONG}</p> : null}

      <div className="border-separator flex flex-wrap items-center gap-2 border-t pt-2">
        <ActionPicker onPick={insertText} />
        <span className="flex-1" />
        {personas.length > 0 ? (
          <PersonaSelect
            label="Posting as"
            personas={personas}
            value={personaId}
            onChange={setPersonaId}
            disabled={pending}
          />
        ) : null}
        {slow.remaining > 0 ? (
          <span className="text-footnote text-label-secondary tabular-nums">
            {slowModeNotice(slow.remaining)}
          </span>
        ) : null}
        <span
          className={cn(
            "text-caption tabular-nums",
            tooLong ? "text-destructive-ink" : "text-label-tertiary"
          )}
        >
          {`${count.toLocaleString("en-US")} / ${BOARD_MESSAGE_MAX.toLocaleString("en-US")}`}
        </span>
        <Button type="button" size="sm" onClick={() => void submit()} disabled={!canSubmit}>
          Post
        </Button>
      </div>
    </Card>
  );
}

/** The realm board's composer: the light editor with Attach action, Posting as, a 1,000 counter and slow mode; the reason instead when the viewer cannot post. */
export function BoardComposer(props: BoardComposerProps) {
  if (!props.access.canPost) return <CannotPost access={props.access} />;
  return <PostingComposer {...props} />;
}
