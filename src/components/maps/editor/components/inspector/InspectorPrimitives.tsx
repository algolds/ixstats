"use client";
import React, { useState } from "react";
import { NavArrowDown as ChevronDown, NavArrowUp as ChevronUp } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Eyebrow } from "~/components/ui/eyebrow";
import { cn } from "~/lib/utils/cn";

const UNIT_CLASS = "text-label-secondary text-footnote shrink-0 font-sans font-normal";

/** Headline number with an optional unit and a sub-line (children). `plain` swaps the Card for a bordered div. */
export function MetricCard({
  label,
  value,
  unit,
  plain = false,
  children,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string | false | null;
  plain?: boolean;
  children?: React.ReactNode;
}) {
  const content = (
    <>
      <span className="text-stat-label text-label-secondary block truncate">{label}</span>
      <div className="mt-0.5 flex min-w-0 items-baseline gap-1">
        <span className="text-label text-headline truncate tabular-nums">{value}</span>
        {unit && <span className={UNIT_CLASS}>{unit}</span>}
      </div>
      {children}
    </>
  );
  return plain ? (
    <div className="border-separator rounded-control min-w-0 border p-2">{content}</div>
  ) : (
    <Card className="min-w-0 p-2">{content}</Card>
  );
}

/** Small tinted tile: label, value, and optional detail lines (children). */
export function ReadoutTile({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-separator bg-fill-4 rounded-control-sm min-w-0 space-y-1 p-2">
      <span className="text-stat-label text-label-secondary block">{label}</span>
      <p className="text-label text-caption font-semibold tabular-nums">{value}</p>
      {children}
    </div>
  );
}

export function ReadoutRow({
  label,
  value,
  className,
  valueClassName = "text-label font-medium tabular-nums",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("text-footnote flex items-center justify-between", className)}>
      <span className="text-label-secondary">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}

export function InspectorSection({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <Card className="overflow-hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="h-auto min-h-(--control-height-sm) w-full justify-between justify-start py-2 text-left whitespace-normal"
      >
        <Eyebrow>{title}</Eyebrow>
        <Chevron className="h-3.5 w-3.5 opacity-60" />
      </Button>
      {open && <div className="border-separator space-y-2 border-t p-3">{children}</div>}
    </Card>
  );
}
