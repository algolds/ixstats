"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
  type Ref,
} from "react";
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
import { useMyPersonas } from "../composer/PersonaSelect";
import { PostingAs } from "../composer/PostingAs";
import { BottomDock } from "../shell";
import type { BoardAccess, BoardQuote, ReplyTarget } from "./types";
import { useDockCollapse } from "./useDockCollapse";
import { retryAfterSecondsOf, useSlowMode } from "./useSlowMode";

const GlassPlateEditor = dynamic(
  () => import("~/components/shared/editor/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  { loading: () => <Skeleton className="rounded-control h-20" />, ssr: false }
);

/** Elements that handle their own focus; a mouse down on them must not be redirected. */
const OWN_FOCUS = "input, textarea, select, button, a, [contenteditable='true'], [role='combobox']";

/** The docked editor stays short, so the dock leaves most of the screen to the messages. */
const DOCKED_EDITOR_MAX_HEIGHT = 96;
/** Folded to one line, the docked editor is just its placeholder. */
const COLLAPSED_EDITOR_HEIGHT = 24;

/** What the page can ask of the composer. */
export interface BoardComposerHandle {
  /** Puts the caret in the editor (an empty board's "Write a message"). A composer folded in the dock opens. */
  focus: () => void;
}

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
  /** Phones: the composer is docked above the tab bar instead of sitting in the page. */
  docked?: boolean;
  ref?: Ref<BoardComposerHandle>;
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
  docked = false,
  ref,
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
  useImperativeHandle(ref, () => ({ focus: () => editorRef.current?.focusEnd() }), []);

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
  const { collapsed, surface } = useDockCollapse(
    docked,
    hasBody,
    pending || replyTo !== null || error !== null
  );

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
      variant={docked ? "well" : "pane"}
      padding={docked ? "sm" : "md"}
      content="input"
      data-slot="board-composer"
      data-collapsed={collapsed ? "" : undefined}
      className={cn("group flex cursor-text gap-2", collapsed ? "items-center" : "flex-col")}
      onMouseDown={focusEditor}
      {...surface}
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

      {/* The editor is always here: folding the dock only hides what surrounds it, so a draft is never remounted. */}
      <div className={cn("min-w-0", collapsed && "flex-1")}>
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
          hideToolbar={collapsed}
          minHeight={collapsed ? COLLAPSED_EDITOR_HEIGHT : docked ? 40 : 64}
          maxHeight={docked ? DOCKED_EDITOR_MAX_HEIGHT : 240}
          className="border-transparent bg-transparent shadow-none"
        />
      </div>

      {error ? <Signal tone="destructive" title={error} /> : null}
      {tooLong ? <p className="text-footnote text-label-secondary">{BOARD_TOO_LONG}</p> : null}

      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2",
          collapsed ? "contents" : "border-separator border-t pt-2"
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 group-data-[collapsed]:hidden">
          <ActionPicker onPick={insertText} />
          <PostingAs
            personas={personas}
            value={personaId}
            onChange={setPersonaId}
            disabled={pending}
          />
        </div>
        {slow.remaining > 0 ? (
          <span className="text-footnote text-label-secondary tabular-nums group-data-[collapsed]:hidden">
            {slowModeNotice(slow.remaining)}
          </span>
        ) : null}
        <span
          className={cn(
            "text-caption tabular-nums group-data-[collapsed]:hidden",
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

/**
 * The realm board's composer: the light editor with Attach action, Posting as, a 1,000 counter and slow mode; the
 * reason instead when the viewer cannot post. `docked` (phones) puts the editor in a dock above the tab bar, folded to
 * a one-line bar (the placeholder and Post) until it has focus or a draft.
 */
export function BoardComposer(props: BoardComposerProps) {
  if (!props.access.canPost) return <CannotPost access={props.access} />;
  return (
    <BottomDock docked={props.docked === true} slot="board-dock">
      <PostingComposer {...props} />
    </BottomDock>
  );
}
