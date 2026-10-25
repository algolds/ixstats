"use client";

import { useState } from "react";
import { Clock, Community, MapPin, NavArrowRight, User } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { isLoreType, type LoreType } from "~/lib/lore/lore-types";

const TYPES = [
  {
    value: "person",
    label: "Person",
    description: "A life: early years, career and legacy",
    Icon: User,
  },
  {
    value: "place",
    label: "Place",
    description: "A city or settlement, its region and its people",
    Icon: MapPin,
  },
  {
    value: "event",
    label: "Event",
    description: "What led to it, how it went and what followed",
    Icon: Clock,
  },
  {
    value: "organisation",
    label: "Organisation",
    description: "An institution, its founding, seat and leader",
    Icon: Community,
  },
] as const;

/** The lore writer's first step: what the piece is about. */
export function LoreTypeStep({
  value,
  onContinue,
}: {
  value: LoreType | null;
  onContinue: (type: LoreType) => void;
}) {
  const [choice, setChoice] = useState<LoreType | null>(value);
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <p className="text-headline text-label">What is this piece about?</p>
      <RadioCardGroup
        aria-label="Lore type"
        columns={2}
        value={choice}
        onValueChange={(next) => isLoreType(next) && setChoice(next)}
      >
        {TYPES.map(({ value: type, label, description, Icon }) => (
          <RadioCard
            key={type}
            value={type}
            title={label}
            description={description}
            icon={<Icon />}
          />
        ))}
      </RadioCardGroup>
      <div className="border-separator flex justify-end border-t pt-4">
        <Button size="sm" disabled={choice === null} onClick={() => choice && onContinue(choice)}>
          Continue
          <NavArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
