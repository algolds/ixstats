"use client";

import { useId, useState } from "react";
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

export interface MyPersonas {
  personas: PersonaOption[];
  /** The persona the member's newest post was written as; null when it was as themself (or the persona is gone). */
  lastUsedPersonaId: string | null;
}

const NO_PERSONAS: MyPersonas = { personas: [], lastUsedPersonaId: null };

/** The member's active personas, fetched only where in-character posting is allowed. */
export function useMyPersonas(enabled: boolean): MyPersonas {
  const { data } = api.thinkpagesForum.myPersonas.useQuery(undefined, { enabled });
  // A disabled query still returns what an earlier mount cached: a board without in-character posts must not see it.
  return enabled && data ? data : NO_PERSONAS;
}

/**
 * Who a composer posts as. Until the member picks, it is whoever they posted as last (which arrives with the personas
 * query, after the first render); a pick, even "yourself", is kept from then on.
 */
export function usePersonaChoice(
  lastUsedPersonaId: string | null
): [string | null, (personaId: string | null) => void] {
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  return [chosen === undefined ? lastUsedPersonaId : chosen, setChosen];
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
