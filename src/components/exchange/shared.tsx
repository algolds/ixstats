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
import {
  CREDIT_RATINGS,
  SUB_INDUSTRIES,
  borrowRateFor,
  computeCompanyMetrics,
  subIndustriesOf,
  type CompanyMetrics,
  type CreditRating,
  type SubIndustry,
  type SubIndustryKey,
} from "~/lib/exchange/taxonomy";
import { formatSovereigns, round2 } from "~/lib/exchange/amounts";

export { formatSovereigns, round2 };
export {
  CREDIT_RATINGS,
  SUB_INDUSTRIES,
  borrowRateFor,
  computeCompanyMetrics,
  subIndustriesOf,
  type CompanyMetrics,
  type CreditRating,
  type SubIndustry,
  type SubIndustryKey,
};

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

export function subIndustryOf(key: string): SubIndustry | undefined {
  return SUB_INDUSTRIES.find((s) => s.key === key);
}

export function subIndustryLabel(key: string): string {
  return subIndustryOf(key)?.label ?? key;
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

export function SubIndustrySelect({
  id,
  sectorKey,
  value,
  onChange,
}: {
  id: string;
  sectorKey: Sector;
  value: SubIndustryKey;
  onChange: (value: SubIndustryKey) => void;
}) {
  const options = subIndustriesOf(sectorKey);
  const effective = options.some((o) => o.key === value) ? value : (options[0]?.key ?? value);
  return (
    <Select value={effective} onValueChange={(v) => onChange(v as SubIndustryKey)}>
      <SelectTrigger id={id} size="sm" aria-label="Sub-industry">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((sub) => (
          <SelectItem key={sub.key} value={sub.key}>
            {sub.label}
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
  DISTRESSED: "warning",
  DELISTED: "default",
  BANKRUPT: "destructive",
  PASSED: "success",
  REJECTED: "destructive",
  EXPIRED: "default",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  AWARDED: "Awarded",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
  ACTIVE: "Active",
  DISTRESSED: "Distressed",
  DELISTED: "Dissolved",
  BANKRUPT: "Bankrupt",
  PASSED: "Passed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_TONE[status] ?? "default"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

const RATING_TONE: Record<string, BadgeVariant> = {
  AAA: "success",
  AA: "success",
  A: "info",
  BBB: "info",
  B: "secondary",
  CCC: "warning",
  D: "destructive",
};

export function CreditRatingBadge({ rating }: { rating: string }) {
  return <Badge variant={RATING_TONE[rating] ?? "default"}>Rating {rating}</Badge>;
}

/** Parse a whole-number amount field; NaN when empty or invalid. */
export function parseAmount(raw: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : Number.NaN;
}

/** Parse a positive cent-precision amount field; NaN when empty or invalid. */
export function parseDecimalAmount(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0.01 && Math.round(n * 100) === Math.round(n * 10000) / 100
    ? Math.round(n * 100) / 100
    : Number.NaN;
}

export interface CompanyWikiData {
  wikiSlug: string;
  pageTitle: string;
  logoUrl: string | null;
  motto: string | null;
  summary: string | null;
  historyExcerpt: string | null;
  foundedText: string | null;
  keyPeople: string | null;
  products: string | null;
  headquartersText: string | null;
  industryText: string | null;
  syncedAt: string;
}

function strOrNull(v: string | number | boolean | object | null | undefined): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Narrow a Prisma `JsonValue` (`wikiData`) into a typed `CompanyWikiData` record. */
export function readCompanyWikiData(
  raw: string | number | boolean | object | null | undefined
): CompanyWikiData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, string | number | boolean | object | null | undefined>;
  const wikiSlug = strOrNull(r.wikiSlug);
  const pageTitle = strOrNull(r.pageTitle) ?? (wikiSlug ? wikiSlug.replace(/_/g, " ") : null);
  if (!wikiSlug || !pageTitle) return null;
  return {
    wikiSlug,
    pageTitle,
    logoUrl: strOrNull(r.logoUrl),
    motto: strOrNull(r.motto),
    summary: strOrNull(r.summary),
    historyExcerpt: strOrNull(r.historyExcerpt),
    foundedText: strOrNull(r.foundedText),
    keyPeople: strOrNull(r.keyPeople),
    products: strOrNull(r.products),
    headquartersText: strOrNull(r.headquartersText),
    industryText: strOrNull(r.industryText),
    syncedAt: strOrNull(r.syncedAt) ?? "",
  };
}

// One copy of the money math for the UI and the server.
export {
  borrowRateOf,
  computeFairValue,
  creditLimitFor,
  type FairValueBreakdown,
} from "~/lib/exchange/valuation";

/** Hours left in the 72-hour distress grace window before liquidation. */
export function distressHoursLeft(distressedSinceIxTime: number | null): number {
  if (!distressedSinceIxTime) return 72;
  const deadline = distressedSinceIxTime + 72 * 3600 * 1000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / (3600 * 1000)));
}
