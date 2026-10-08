"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { ValueSelect } from "~/components/ui/value-select";

const NONE = "__none";

/** One section of the pipeline form: a pane of the input content type, titled with a tinted icon. */
export function PipelineSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card content="input" className="flex flex-col gap-4 py-5">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle icon={icon}>{title}</CardTitle>
          {description && (
            <CardDescription className="text-footnote">{description}</CardDescription>
          )}
        </div>
        {action}
      </CardHeader>
      {children && <CardContent className="flex flex-col gap-4">{children}</CardContent>}
    </Card>
  );
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="text-destructive-ink text-footnote">
      {error}
    </p>
  );
}

/** aria props tying a control to its error line. */
export const invalidProps = (id: string, error?: string) =>
  error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

/** A labelled control with its error below. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-label-secondary text-footnote">{hint}</p>}
      <FieldError id={id} error={error} />
    </div>
  );
}

const shown = (value: number | undefined | null) =>
  value === undefined || value === null || Number.isNaN(value) ? "" : String(value);

/**
 * A number input that keeps what is typed: an empty field is `undefined` when `optional` (the default applies),
 * else NaN (validation names it); anything else is the number.
 */
export function NumberInput({
  value,
  onChange,
  optional = false,
  className,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | undefined | null;
  onChange: (value: number | undefined) => void;
  optional?: boolean;
}) {
  const [text, setText] = useState(shown(value));
  const parsed = text.trim() === "" ? undefined : Number(text);
  const display = shown(parsed) === shown(value) ? text : shown(value);
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="any"
      className={className}
      value={display}
      onChange={(e) => {
        setText(e.target.value);
        const raw = e.target.value.trim();
        if (raw === "") onChange(optional ? undefined : Number.NaN);
        else onChange(Number(raw));
      }}
      {...props}
    />
  );
}

/** Choose one of the pipeline's art files (or none, with `noneLabel`). */
export function ArtSelect({
  id,
  value,
  artKeys,
  onChange,
  error,
  noneLabel,
  ariaLabel,
}: {
  id?: string;
  value: string | undefined;
  artKeys: readonly string[];
  onChange: (key: string | undefined) => void;
  error?: string;
  noneLabel?: string;
  ariaLabel?: string;
}) {
  const keys = value && !artKeys.includes(value) ? [value, ...artKeys] : artKeys;
  const options: Array<readonly [string, string]> = [
    ...(noneLabel ? [[NONE, noneLabel] as const] : []),
    ...keys.map((key) => [key, key] as const),
  ];
  return (
    <ValueSelect
      id={id}
      aria-label={ariaLabel}
      value={value ?? (noneLabel ? NONE : undefined)}
      placeholder="Choose art"
      options={options}
      onValueChange={(next) => onChange(next === NONE ? undefined : next)}
      {...invalidProps(id ?? ariaLabel ?? "art", error)}
    />
  );
}

/** A colour swatch picker and its #rrggbb text, kept in step. */
export function ColourInput({
  value,
  onChange,
  label,
  error,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  error?: string;
  id: string;
}) {
  const swatch = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label}, picker`}
        className="border-separator rounded-control-sm h-8 w-10 shrink-0 cursor-pointer border bg-transparent"
        value={swatch}
        onChange={(e) => onChange(e.target.value)}
      />
      <Input
        id={id}
        aria-label={label}
        className="font-data w-28"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        {...invalidProps(id, error)}
      />
    </div>
  );
}

/** A switch with its label on one line. */
export function SwitchRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
