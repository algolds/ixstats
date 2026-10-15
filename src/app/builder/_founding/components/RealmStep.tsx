"use client";

import { forwardRef } from "react";
import { Globe } from "iconoir-react";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import type { RouterOutputs } from "~/trpc/react";
import { StepCard } from "./StepCard";

export type BuilderRealm = RouterOutputs["realms"]["builderRealms"]["realms"][number];

interface RealmStepProps {
  realms: readonly BuilderRealm[];
  value: string | null;
  onChange: (realmId: string) => void;
  error?: string;
}

function roomLine(realm: BuilderRealm): string {
  if (!realm.canCreate) {
    return `You hold ${realm.held} of ${realm.cap} ${realm.cap === 1 ? "nation" : "nations"} allowed here`;
  }
  const room = realm.cap - realm.held;
  return `You can found ${room} more ${room === 1 ? "nation" : "nations"} here`;
}

/** Which realm the nation is founded in; shown only when more than one realm has room. */
export const RealmStep = forwardRef<HTMLDivElement, RealmStepProps>(function RealmStep(
  { realms, value, onChange, error },
  headingRef
) {
  return (
    <StepCard
      ref={headingRef}
      id="founding-realm"
      icon={<Globe />}
      title="Where will your nation be?"
      description="Each realm is its own world with its own nations and clock. You can change this until you found."
    >
      <div className="flex flex-col gap-2">
        <RadioCardGroup
          id="founding-realm-choice"
          aria-labelledby="founding-realm-title"
          aria-describedby={error ? "founding-realm-error" : undefined}
          value={value}
          onValueChange={onChange}
          columns={2}
        >
          {realms.map((realm) => (
            <RadioCard
              key={realm.id}
              value={realm.id}
              disabled={!realm.canCreate}
              title={realm.name}
              description={roomLine(realm)}
            />
          ))}
        </RadioCardGroup>
        {error && (
          <p id="founding-realm-error" className="text-footnote text-destructive">
            {error}
          </p>
        )}
      </div>
    </StepCard>
  );
});
