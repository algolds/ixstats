"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ModContext } from "./ModRow";

const EVERYTHING = "all";

export interface ScopeRealm {
  slug: string;
  name: string;
}

/** The realms the console can narrow to: those the viewer moderates, plus the realms of their categories. */
export function scopeRealms(context: ModContext): ScopeRealm[] {
  const bySlug = new Map<string, ScopeRealm>(context.realms.map((r) => [r.slug, r]));
  for (const { realm } of context.categories) {
    if (realm && !bySlug.has(realm.slug)) bySlug.set(realm.slug, realm);
  }
  return [...bySlug.values()];
}

interface ModScopeFilterProps {
  realms: ScopeRealm[];
  /** The selected realm's slug; undefined for everything. */
  value?: string;
  onChange: (realm: string | undefined) => void;
}

/** Narrows the console's lists to one realm the viewer moderates, or shows everything. */
export function ModScopeFilter({ realms, value, onChange }: ModScopeFilterProps) {
  if (realms.length === 0) return null;
  return (
    <Select
      value={value ?? EVERYTHING}
      onValueChange={(next) => onChange(next === EVERYTHING ? undefined : next)}
    >
      <SelectTrigger aria-label="Scope" className="w-full sm:w-64">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EVERYTHING}>Everything I moderate</SelectItem>
        {realms.map((realm) => (
          <SelectItem key={realm.slug} value={realm.slug}>
            {realm.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
