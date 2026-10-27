"use client";

import { forwardRef, type ReactNode } from "react";
import { CheckCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EntityHeader } from "~/components/ui/entity-header";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Signal } from "~/components/ui/signal";
import { getGovernmentForm } from "~/lib/government/forms";
import { assetUrl } from "~/lib/base-path";
import { bandLabel, getArchetypeOption } from "../lib/founding-archetypes";
import {
  activeComponents,
  activeInstitutions,
  effectiveBands,
  type FoundingDraft,
  type FoundingStepId,
} from "../lib/founding-draft";
import type { FoundingError } from "../lib/founding-errors";
import { formatMoney, formatPeople, type FoundingSummary } from "../lib/founding-format";
import { MORE_DETAIL_FIELD_IDS } from "./IdentityStep";
import { NationCard } from "./NationCard";
import { StepCard } from "./StepCard";

interface Row {
  title: string;
  value: ReactNode;
}

function Group({
  header,
  rows,
  step,
  onEdit,
}: {
  header: string;
  rows: Row[];
  step: FoundingStepId;
  onEdit: (step: FoundingStepId) => void;
}) {
  return (
    <FacetListSection header={header}>
      {rows.map((row) => (
        <FacetRow
          key={row.title}
          title={row.title}
          trailing={<span className="text-label-secondary text-right">{row.value}</span>}
        />
      ))}
      <FacetRow
        title={`Edit ${header.toLowerCase()}`}
        accessory="chevron"
        onClick={() => onEdit(step)}
      />
    </FacetListSection>
  );
}

const orDash = (value: string) => value.trim() || "–";

interface ReviewStepProps {
  draft: FoundingDraft;
  realmName: string | null;
  showRealm: boolean;
  summary: FoundingSummary | null | undefined;
  stale: boolean;
  error: FoundingError | null;
  onEdit: (step: FoundingStepId) => void;
}

/** Everything the nation is founded with, one group per step, and what founding does next. */
export const ReviewStep = forwardRef<HTMLDivElement, ReviewStepProps>(function ReviewStep(
  { draft, realmName, showRealm, summary, stale, error, onEdit },
  headingRef
) {
  const { identity, government, economy } = draft;
  const archetype = getArchetypeOption(draft.start.archetypeKey);
  const form = getGovernmentForm(government.formId);
  const institutions = activeInstitutions(government, true);
  const bands = effectiveBands(draft);
  const size = economy.exactPopulation
    ? `${formatPeople(economy.exactPopulation)} people`
    : bandLabel.population(bands.population);
  const wealth = economy.exactGdpPerCapita
    ? `${formatMoney(economy.exactGdpPerCapita)} per person`
    : bandLabel.wealth(bands.wealth);
  const moreFilled = MORE_DETAIL_FIELD_IDS.filter((id) => identity[id].trim()).length;
  const flag = identity.flagUrl.trim();
  const name = identity.name.trim();
  const facts = [
    realmName,
    form?.name,
    `${bandLabel.population(bands.population)} size`,
    bandLabel.wealth(bands.wealth),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <EntityHeader
        headingLevel={2}
        art={
          flag ? (
            <img
              src={assetUrl(flag) ?? undefined}
              referrerPolicy="no-referrer"
              alt={`Flag of ${name}`}
              className="border-separator rounded-control-sm h-12 w-20 border object-cover"
            />
          ) : undefined
        }
        name={name}
        facts={facts}
        className="px-2"
      />
      {error && (
        <Signal tone="destructive" title={error.title}>
          <p>{error.body}</p>
          {error.fix && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => onEdit(error.fix!.step)}
            >
              {error.fix.label}
            </Button>
          )}
        </Signal>
      )}
      <StepCard
        ref={headingRef}
        id="founding-review"
        icon={<CheckCircle />}
        title="Check and found"
        description="Edit anything below, then found your nation."
      >
        <FacetList variant="plain">
          {showRealm && (
            <Group
              header="Realm"
              step="realm"
              onEdit={onEdit}
              rows={[{ title: "Founded in", value: orDash(realmName ?? "") }]}
            />
          )}
          <Group
            header="Start"
            step="start"
            onEdit={onEdit}
            rows={[
              {
                title: "Kind of nation",
                value: archetype ? archetype.display.displayName : "Blank start",
              },
              ...(draft.imported ? [{ title: "Imported from", value: draft.imported.title }] : []),
            ]}
          />
          <Group
            header="Identity"
            step="identity"
            onEdit={onEdit}
            rows={[
              { title: "Name", value: orDash(name) },
              { title: "Flag", value: flag ? "Chosen" : "None yet" },
              { title: "Capital city", value: orDash(identity.capitalCity) },
              { title: "Official language", value: orDash(identity.officialLanguages) },
              { title: "Currency", value: orDash(identity.currency) },
              { title: "Motto", value: orDash(identity.motto) },
              {
                title: "More details",
                value: moreFilled === 0 ? "None filled in" : `${moreFilled} filled in`,
              },
            ]}
          />
          <Group
            header="Government"
            step="government"
            onEdit={onEdit}
            rows={[
              { title: "Form", value: form?.name ?? "–" },
              { title: "Head of state", value: institutions.headOfStateTitle },
              { title: "Head of government", value: institutions.headOfGovernmentTitle },
              { title: "Legislature", value: institutions.legislatureName },
              {
                title: "Institutions",
                value: `${activeComponents(government).length}${government.components ? ", customised" : ""}`,
              },
            ]}
          />
          <Group
            header="Economy"
            step="economy"
            onEdit={onEdit}
            rows={[
              { title: "Population", value: size },
              { title: "Wealth", value: wealth },
            ]}
          />
        </FacetList>

        <section className="flex flex-col gap-3" aria-labelledby="founding-review-figures">
          <h3 id="founding-review-figures" className="text-headline text-label">
            Your nation at founding
          </h3>
          <NationCard summary={summary} stale={stale} size="md" announce={false} />
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="founding-review-next">
          <h3 id="founding-review-next" className="text-headline text-label">
            What happens next
          </h3>
          <ul className="text-callout text-label-secondary flex list-disc flex-col gap-1 pl-5">
            <li>
              {name || "Your nation"} becomes your active nation
              {realmName ? ` in ${realmName}` : ""}.
            </li>
            <li>MyCountry opens with a short list of first steps.</li>
            <li>You can change your identity and government at any time in the editor.</li>
            <li>Your budget, taxes and cabinet are set in MyCountry.</li>
          </ul>
        </section>
      </StepCard>
    </div>
  );
});
