"use client";

import { useId } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

export interface PersonaOption {
  id: string;
  displayName: string;
  username: string;
}

const SELF = "self";
const NO_PERSONAS: PersonaOption[] = [];

/** The member's active personas, fetched only where in-character posting is allowed. */
export function useMyPersonas(enabled: boolean): PersonaOption[] {
  const { data } = api.thinkpagesForum.myPersonas.useQuery(undefined, { enabled });
  return data ?? NO_PERSONAS;
}

interface PersonaSelectProps {
  label: string;
  personas: readonly PersonaOption[];
  /** The chosen persona's id; null posts as the member. */
  value: string | null;
  onChange: (personaId: string | null) => void;
  disabled?: boolean;
}

/** "Post as": the member themselves, or one of their personas. */
export function PersonaSelect({ label, personas, value, onChange, disabled }: PersonaSelectProps) {
  const labelId = useId();
  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="text-footnote text-label-secondary">
        {label}
      </span>
      <Select
        value={value ?? SELF}
        onValueChange={(v) => onChange(v === SELF ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger size="sm" aria-labelledby={labelId} className="pointer-coarse:min-h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELF}>Yourself</SelectItem>
          {personas.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.displayName} (@{p.username})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
