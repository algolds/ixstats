"use client";

import { useId } from "react";
import { api } from "~/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface BuilderRealmPickerProps {
  /** The chosen realm id; null/undefined → the server's default (the active nation's realm, else IxWorld). */
  value: string | null | undefined;
  onChange: (realmId: string) => void;
}

/**
 * Which realm a new nation is founded in. Shown only when more than one realm is open to the player; with one
 * realm it only says so when the player is already at their nation cap there.
 */
export function BuilderRealmPicker({ value, onChange }: BuilderRealmPickerProps) {
  const labelId = useId();
  const { data } = api.realms.builderRealms.useQuery(undefined, { staleTime: 60_000 });
  if (!data || data.realms.length === 0) return null;

  const selectedId = value ?? data.defaultRealmId;
  const selected = data.realms.find((realm) => realm.id === selectedId);
  const full = selected && !selected.canCreate && (
    <p role="status" className="text-footnote text-caution">
      You hold {selected.held} of {selected.cap} {selected.cap === 1 ? "nation" : "nations"} allowed
      in {selected.name}.
    </p>
  );

  if (data.realms.length === 1) return full || null;

  return (
    <div className="flex flex-col gap-1">
      <div className="text-label-secondary text-footnote flex items-center gap-2">
        <span id={labelId}>Found in</span>
        <Select value={selectedId} onValueChange={onChange}>
          <SelectTrigger size="sm" aria-labelledby={labelId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.realms.map((realm) => (
              <SelectItem key={realm.id} value={realm.id} disabled={!realm.canCreate}>
                {realm.name} ({realm.held}/{realm.cap})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {full}
    </div>
  );
}
