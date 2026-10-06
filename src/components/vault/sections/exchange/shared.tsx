"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export { formatSovereigns } from "~/lib/exchange/quote";

export const SECTORS = [
  { value: "agriculture", label: "Agriculture" },
  { value: "industry", label: "Industry" },
  { value: "services", label: "Services" },
  { value: "government", label: "Government" },
] as const;

export type Sector = (typeof SECTORS)[number]["value"];

export function sectorLabel(key: string): string {
  return SECTORS.find((s) => s.value === key)?.label ?? key;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * A request id for one money-moving action. It stays the same until `rotate` is called
 * (after a success), so resubmitting after a network failure is applied at most once.
 */
export function useRequestId(): [string, () => void] {
  const [id, setId] = useState(newId);
  const rotate = useCallback(() => setId(newId()), []);
  return [id, rotate];
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function SectorSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Sector;
  onChange: (value: Sector) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Sector)}>
      <SelectTrigger id={id} size="sm" aria-label="Sector">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SECTORS.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CompanySelect({
  id,
  companies,
  value,
  onChange,
}: {
  id: string;
  companies: ReadonlyArray<{ id: string; name: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} size="sm" aria-label="Company">
        <SelectValue placeholder="Choose a company" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const STATUS_TONE: Record<string, BadgeVariant> = {
  OPEN: "info",
  AWARDED: "secondary",
  COMPLETED: "success",
  CANCELLED: "default",
  DISPUTED: "warning",
  ACTIVE: "success",
  DELISTED: "default",
  BANKRUPT: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  AWARDED: "Awarded",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
  ACTIVE: "Active",
  DELISTED: "Dissolved",
  BANKRUPT: "Bankrupt",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_TONE[status] ?? "default"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

/** Parse a whole-number amount field; NaN when empty or invalid. */
export function parseAmount(raw: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : Number.NaN;
}
