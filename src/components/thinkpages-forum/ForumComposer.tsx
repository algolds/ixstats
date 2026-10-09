"use client";

import { useCallback, useId, useRef, useState, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import { ActionPicker } from "~/components/action-links";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import type { GlassPlateEditorRef } from "~/components/shared/editor";
import { hasImageSrc } from "~/lib/thinkpages-forum/html-urls";
import { api } from "~/trpc/react";

const GlassPlateEditor = dynamic(
  () => import("~/components/shared/editor/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  { loading: () => <Skeleton className="rounded-control h-20" />, ssr: false }
);

const SELF = "self";
/** Elements that handle their own focus; a mouse down on them must not be redirected. */
const OWN_FOCUS = "input, textarea, select, button, a, [contenteditable='true'], [role='combobox']";

export interface ForumComposerInput {
  html: string;
  personaId: string | null;
  title?: string;
}

interface ForumComposerProps {
  icAllowed: boolean;
  submitLabel?: string;
  titleField?: boolean;
  /** Stored post HTML to start from (editing a post). */
  initialHtml?: string;
  onSubmit: (input: ForumComposerInput) => Promise<void>;
}

/**
 * Forum post composer. The editor is always mounted, so there is no expand step: one mouse
 * down on the composer surface puts the caret in the text field.
 */
export function ForumComposer({
  icAllowed,
  submitLabel = "Post",
  titleField = false,
  initialHtml = "",
  onSubmit,
}: ForumComposerProps) {
  const editorRef = useRef<GlassPlateEditorRef>(null);
  const postAsId = useId();
  const [html, setHtml] = useState(initialHtml);
  // Only gates Save until the editor reports its own plain text.
  const [plain, setPlain] = useState(() => initialHtml.replace(/<[^>]*>/g, ""));
  const [title, setTitle] = useState("");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: personas = [] } = api.thinkpagesForum.myPersonas.useQuery(undefined, {
    enabled: icAllowed,
  });

  const focusEditor = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    // Portaled popovers (persona list, action picker) bubble through React but sit outside the surface.
    if (!event.currentTarget.contains(target) || target.closest(OWN_FOCUS)) return;
    // Without this the browser moves focus to the body after the handler and the caret is lost.
    event.preventDefault();
    editorRef.current?.focusEnd();
  }, []);

  const insertToken = useCallback((token: string) => {
    editorRef.current?.focusEnd();
    editorRef.current?.insertText(token);
    // The popover returns focus to its trigger on close; take it back so typing continues.
    requestAnimationFrame(() => editorRef.current?.focusEnd());
  }, []);

  // An image counts as content, as it does on the server (prepareBody).
  const hasBody = plain.trim().length > 0 || hasImageSrc(html);
  const canSubmit = hasBody && (!titleField || title.trim().length > 0) && !pending;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        html,
        personaId: icAllowed ? personaId : null,
        ...(titleField ? { title: title.trim() } : {}),
      });
      editorRef.current?.clear();
      setHtml("");
      setPlain("");
      setTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post");
    } finally {
      setPending(false);
    }
  }, [canSubmit, onSubmit, html, icAllowed, personaId, titleField, title]);

  return (
    <div
      data-slot="forum-composer"
      className="facet-chrome rounded-card flex cursor-text flex-col gap-2 p-2"
      onMouseDown={focusEditor}
    >
      {titleField ? (
        <Input
          placeholder="Thread title"
          aria-label="Thread title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={pending}
        />
      ) : null}

      <GlassPlateEditor
        ref={editorRef}
        value={html}
        onChange={(nextHtml, nextPlain) => {
          setHtml(nextHtml);
          setPlain(nextPlain);
        }}
        placeholder="Write something"
        allowImageInsert
        disabled={pending}
        minHeight={96}
        maxHeight={320}
        className="border-transparent bg-transparent shadow-none"
      />

      {error ? (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive text-footnote rounded-control px-3 py-2"
        >
          {error}
        </div>
      ) : null}

      <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <ActionPicker onPick={insertToken} />
          {icAllowed ? (
            <div className="flex items-center gap-2">
              <span id={postAsId} className="text-footnote text-label-secondary">
                Post as
              </span>
              <Select
                value={personaId ?? SELF}
                onValueChange={(v) => setPersonaId(v === SELF ? null : v)}
                disabled={pending}
              >
                <SelectTrigger size="sm" aria-labelledby={postAsId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELF}>Yourself</SelectItem>
                  {personas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName} (@{p.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <Button type="button" size="sm" onClick={() => void submit()} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
