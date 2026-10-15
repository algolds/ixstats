"use client";

import { useRef, useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { STALE_EDITOR_MESSAGE } from "~/lib/mycountry/editor-fields";
import { cn } from "~/lib/utils";
import { useEditor } from "./editor-context";

/**
 * One section of the editor: an anchor the nav links to, an h2 with a tinted icon, and its fields.
 * Each section keeps its own values and saves on its own button.
 */
export function EditorSection({
  id,
  title,
  icon,
  description,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <Card content="input" padding="lg">
        <CardHeader className="px-0 pb-4">
          <CardTitle icon={icon} id={`${id}-title`} role="heading" aria-level={2}>
            {title}
          </CardTitle>
          {description && (
            <p className="text-label-secondary text-footnote max-w-[70ch]">{description}</p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">{children}</CardContent>
      </Card>
    </section>
  );
}

/**
 * The section's one save button, named for what it saves. Disabled until something changed and
 * while saving. With a problem in a field it saves nothing and moves focus to the first field
 * that needs fixing, whose message is read out.
 */
export function SaveButton({
  label,
  dirty,
  invalid,
  pending,
  blocked = false,
  onSave,
}: {
  label: string;
  dirty: boolean;
  invalid: boolean;
  pending: boolean;
  /** Not ready yet for a reason the section shows (a name still being checked). */
  blocked?: boolean;
  onSave: () => void;
}) {
  const { stale, saving } = useEditor();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <Button
        ref={ref}
        type="button"
        className="w-full sm:w-auto"
        disabled={!dirty || pending || blocked || stale || saving}
        aria-busy={pending || undefined}
        onClick={() => {
          if (invalid) {
            const field = ref.current
              ?.closest("section")
              ?.querySelector<HTMLElement>('[aria-invalid="true"]');
            field?.focus();
            return;
          }
          onSave();
        }}
      >
        {pending ? "Saving…" : label}
      </Button>
      {dirty && !pending && (
        <span className="text-label-secondary text-footnote">Unsaved changes</span>
      )}
    </div>
  );
}

/** Success and error handling every section's save shares. */
export function useSaveHandlers(messages: { saved: string; failed: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { setVersion, markStale, beginSave, endSave } = useEditor();
  return {
    onMutate: beginSave,
    onSettled: endSave,
    onSuccess: (result: { updatedAt: Date }) => {
      setVersion(result.updatedAt);
      notify.success(messages.saved);
      // The section re-keys from the saved values once they come back.
      void utils.countries.getEditorState.invalidate();
    },
    onError: (error: { message: string; data?: { code?: string } | null }) => {
      if (error.data?.code === "CONFLICT" && error.message === STALE_EDITOR_MESSAGE) markStale();
      notify.error(messages.failed, error.message);
    },
  };
}

/** A labelled text field with a one-line helper that turns into the error when there is one. */
export function TextField({
  id,
  label,
  value,
  onChange,
  helper,
  error,
  placeholder,
  inputMode,
  type = "text",
  className,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string | null;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: "text" | "number";
  className?: string;
  maxLength?: number;
}) {
  const note = error ?? helper;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? `${id}-note` : undefined}
        className={cn("min-h-11 sm:min-h-0", className)}
      />
      {note && (
        <p
          id={`${id}-note`}
          aria-live={error ? "polite" : undefined}
          className={
            error ? "text-destructive text-footnote" : "text-label-secondary text-footnote"
          }
        >
          {note}
        </p>
      )}
    </div>
  );
}

/** Local state for a set of text values, with what changed since the server values. */
export function useDraft<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const changed = (Object.keys(initial) as Array<keyof T>).filter(
    (key) => values[key] !== initial[key]
  );
  return {
    values,
    set: (key: keyof T, value: string) => setValues((v) => ({ ...v, [key]: value })),
    setMany: (next: Partial<T>) => setValues((v) => ({ ...v, ...next })),
    changed,
    dirty: changed.length > 0,
  };
}
