"use client";
/** A config section of labelled number inputs with one Save, which sends only the fields that changed. */
import { useState, type ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { numberFieldProblem, type EconomyNumberField } from "~/lib/cards/economy-fields";

/** A typed field's number; an empty field is not a number, so it never saves as 0. */
export const fieldNumber = (raw: string): number => (raw.trim() === "" ? Number.NaN : Number(raw));

interface NumberConfigCardProps<K extends string> {
  id: string;
  title: string;
  icon: ReactNode;
  description?: string;
  fields: ReadonlyArray<EconomyNumberField<K>>;
  initial: Readonly<Record<K, number>>;
  saveLabel: string;
  pending: boolean;
  onSave: (changed: Partial<Record<K, number>>) => void;
  /** Shown above the Save row. */
  children?: ReactNode;
  /** Shown beside Save. */
  action?: ReactNode;
}

export function NumberConfigCard<K extends string>({
  id,
  title,
  icon,
  description,
  fields,
  initial,
  saveLabel,
  pending,
  onSave,
  children,
  action,
}: NumberConfigCardProps<K>) {
  const [draft, setDraft] = useState<Partial<Record<K, string>>>({});
  const rows = fields.map((field) => {
    const raw = draft[field.key] ?? String(initial[field.key]);
    const value = fieldNumber(raw);
    return { field, raw, value, problem: numberFieldProblem(field, value) };
  });
  const changed: Partial<Record<K, number>> = {};
  for (const row of rows) {
    if (row.value !== initial[row.field.key]) changed[row.field.key] = row.value;
  }
  const blocked = rows.some((row) => row.problem) || Object.keys(changed).length === 0;

  return (
    <Card content="input">
      <CardHeader className="pt-5">
        <CardTitle icon={icon}>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ field, raw, problem }) => {
            const inputId = `${id}-${field.key}`;
            const noteId = `${inputId}-note`;
            const note = problem ?? field.hint;
            return (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={inputId}>{field.label}</Label>
                <Input
                  id={inputId}
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step ?? (field.whole ? 1 : "any")}
                  aria-invalid={problem !== null}
                  aria-describedby={note ? noteId : undefined}
                  value={raw}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  className="tabular-nums"
                />
                {note && (
                  <p
                    id={noteId}
                    className={
                      problem
                        ? "text-destructive text-footnote"
                        : "text-label-secondary text-footnote"
                    }
                  >
                    {note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {children}
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={pending || blocked} onClick={() => onSave(changed)}>
            {saveLabel}
          </Button>
          {action}
        </div>
      </CardContent>
    </Card>
  );
}
