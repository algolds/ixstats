"use client";
// src/components/wiki-os/admin/AdminPage.tsx
// Shared shell and form bits for the WikiOS page-admin screens (move, delete, protect, block, user rights, log).

import type { ReactNode } from "react";
import Link from "next/link";
import { WarningTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { EXPIRY_PRESETS, type ExpiryPreset } from "~/lib/wiki-os/page-admin-ui";
import type { Right } from "~/lib/wiki-os/rights";

/** The signed-in user's rights (empty while loading, and for a signed-out visitor). */
export function useWikiRights(): { rights: readonly Right[]; isLoading: boolean } {
  const { data, isLoading } = api.wikios.getUserPermissions.useQuery(undefined, {
    staleTime: 60_000,
  });
  return { rights: data?.rights ?? [], isLoading };
}

interface AdminPageProps {
  title: string;
  description: string;
  children: ReactNode;
}

/** Page frame: the WikiOS layout, a breadcrumb back to the utilities hub, a heading and a short description. */
export function AdminPage({ title, description, children }: AdminPageProps) {
  return (
    <WikiOSLayout hideTitleHeading>
      <div className="mx-auto w-full max-w-2xl space-y-6 pb-16">
        <header className="space-y-1.5">
          <Link
            href={"/util"}
            className="text-muted-foreground hover:text-foreground text-xs font-medium"
          >
            Special:Utilities
          </Link>
          <h1 className="text-foreground font-brand text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </header>
        {children}
      </div>
    </WikiOSLayout>
  );
}

/** Renders `children` only for someone who holds `right`; everyone else is told why not. */
export function RightGate({ right, children }: { right: Right; children: ReactNode }) {
  const { rights, isLoading } = useWikiRights();
  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (rights.includes(right)) return <>{children}</>;
  return (
    <Alert variant="destructive">
      <WarningTriangle />
      <AlertTitle>Permission needed</AlertTitle>
      <AlertDescription>
        This needs the &ldquo;{right}&rdquo; right, which your account does not have.
      </AlertDescription>
    </Alert>
  );
}

/** A labelled form control. */
export function FormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

/** A `?title=` value as it reads: underscores are spaces. */
export function readableTitle(raw: string): string {
  return raw.replace(/_/g, " ").trim();
}

interface ExpirySelectProps {
  value: ExpiryPreset | "keep";
  onChange: (value: ExpiryPreset | "keep") => void;
  /** Offer "keep the current expiry" (for a restriction or membership that already exists). */
  allowKeep?: boolean;
  id?: string;
}

const isPreset = (value: string): value is ExpiryPreset =>
  EXPIRY_PRESETS.some((preset) => preset.value === value);

/** How long something lasts: a preset, or (when editing an existing one) keep what it has. */
export function ExpirySelect({ value, onChange, allowKeep = false, id }: ExpirySelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === "keep" || isPreset(next)) onChange(next);
      }}
    >
      <SelectTrigger id={id} className="w-full sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowKeep && <SelectItem value="keep">Keep current expiry</SelectItem>}
        {EXPIRY_PRESETS.map((preset) => (
          <SelectItem key={preset.value} value={preset.value}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
