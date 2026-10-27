"use client";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { PersonaOption } from "./PersonaSelect";

const SELF = "self";

interface PostingAsProps {
  personas: readonly PersonaOption[];
  /** The chosen persona's id; null posts as the member. */
  value: string | null;
  onChange: (personaId: string | null) => void;
  disabled?: boolean;
}

/**
 * Who the next post is from, as the Home composer says it: "Posting as yourself" or "Posting as @username", then a
 * Switch link that opens the choice. Nothing for a member without personas (there is nobody to switch to).
 */
export function PostingAs({ personas, value, onChange, disabled }: PostingAsProps) {
  if (personas.length === 0) return null;
  const persona = personas.find((p) => p.id === value);
  return (
    <div className="text-footnote flex items-center gap-1.5">
      <span className="text-label-secondary">Posting as</span>
      <span className="text-label font-medium">
        {persona ? `@${persona.username}` : "yourself"}
      </span>
      <span aria-hidden className="text-label-tertiary">
        ·
      </span>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="link"
            size="sm"
            disabled={disabled}
            className="h-auto px-0 pointer-coarse:min-h-11"
          >
            Switch
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={value ?? SELF}
            onValueChange={(next) => onChange(next === SELF ? null : next)}
          >
            <DropdownMenuRadioItem value={SELF}>Yourself</DropdownMenuRadioItem>
            {personas.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id}>
                {`${p.displayName} (@${p.username})`}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
