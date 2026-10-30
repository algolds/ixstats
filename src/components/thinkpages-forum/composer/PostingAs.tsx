"use client";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ForumAvatar } from "../ForumAvatar";
import type { PersonaOption } from "./PersonaSelect";

const SELF = "self";
const SELF_NAME = "Yourself";

interface PostingAsProps {
  personas: readonly PersonaOption[];
  /** The chosen persona's id; null posts as the member. */
  value: string | null;
  onChange: (personaId: string | null) => void;
  disabled?: boolean;
}

/**
 * Who the next post is from, said where it cannot be missed: "Posting as", a chip with the chosen identity's avatar
 * and name ("Yourself" or the persona), then a Switch link that opens the choice. Nothing for a member without
 * personas (there is nobody to switch to).
 */
export function PostingAs({ personas, value, onChange, disabled }: PostingAsProps) {
  if (personas.length === 0) return null;
  const persona = personas.find((p) => p.id === value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-subhead text-label-secondary">Posting as</span>
      <span
        data-slot="posting-as-chip"
        className="border-separator bg-card flex min-w-0 items-center gap-1.5 rounded-full border py-0.5 pr-3 pl-0.5"
      >
        <ForumAvatar name={persona?.displayName ?? SELF_NAME} size="xs" />
        <span className="text-subhead text-label truncate font-medium">
          {persona?.displayName ?? SELF_NAME}
        </span>
        {persona ? (
          <span className="text-footnote text-label-secondary truncate">{`@${persona.username}`}</span>
        ) : null}
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
