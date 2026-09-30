"use client";

import { api } from "~/trpc/react";

export interface BuilderRealmPickerProps {
  /** The chosen realm id; null/undefined → the server's default (the active nation's realm, else IxWorld). */
  value: string | null | undefined;
  onChange: (realmId: string) => void;
}

/**
 * Which realm a new nation is founded in. Shown only when more than one realm is open to the player; with one
 * realm it only says so when the player is already at their nation cap there.
 */
export function BuilderRealmPicker({ value, onChange }: BuilderRealmPickerProps) {
  const { data } = api.realms.builderRealms.useQuery(undefined, { staleTime: 60_000 });
  if (!data || data.realms.length === 0) return null;

  const selectedId = value ?? data.defaultRealmId;
  const selected = data.realms.find((realm) => realm.id === selectedId);
  const full = selected && !selected.canCreate && (
    <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
      You hold {selected.held} of {selected.cap} {selected.cap === 1 ? "nation" : "nations"} allowed
      in {selected.name}.
    </p>
  );

  if (data.realms.length === 1) return full || null;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted-foreground flex items-center gap-2 text-xs">
        <span>Found in</span>
        <select
          value={selectedId}
          onChange={(event) => onChange(event.target.value)}
          className="border-border/60 bg-background text-foreground rounded-lg border px-2 py-1 text-xs"
        >
          {data.realms.map((realm) => (
            <option key={realm.id} value={realm.id} disabled={!realm.canCreate}>
              {realm.name} ({realm.held}/{realm.cap})
            </option>
          ))}
        </select>
      </label>
      {full}
    </div>
  );
}
