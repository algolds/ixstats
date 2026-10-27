"use client";

import { forwardRef, useMemo, useState } from "react";
import type { ComponentType } from "@prisma/client";
import { Bank, NavArrowDown } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { Signal } from "~/components/ui/signal";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import {
  GOVERNMENT_COMPONENT_GROUP,
  getComponentEffect,
  groupComponentsByPlainGroup,
} from "~/lib/government/component-guide";
import {
  GOVERNMENT_FORMS,
  getGovernmentForm,
  type GovernmentFormId,
  type GovernmentInstitutions,
} from "~/lib/government/forms";
import { findSynergyPair, type SynergyPair } from "~/lib/government/synergy-table";
import {
  MAX_GOVERNMENT_COMPONENTS,
  activeComponents,
  activeInstitutions,
  isGovernmentCustomised,
  type FoundingDraft,
} from "../lib/founding-draft";
import { PolicyPresetPicker } from "~/components/shared/government/PolicyPresetPicker";
import { StepCard } from "./StepCard";

/** "Centralized Power Structure" → "Centralized power structure"; acronyms keep their capitals. */
function sentenceCase(text: string): string {
  return text
    .split(" ")
    .map((word, index) => (index === 0 || /^[A-Z0-9]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(" ");
}

/** The plain name of a government component. */
export function componentName(type: ComponentType): string {
  const name = ATOMIC_COMPONENTS[type]?.name;
  if (name) return sentenceCase(name);
  const words = type.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Every component the picker offers: the defined ones, in plain groups. */
const PICKER_GROUPS = groupComponentsByPlainGroup(
  Object.keys(GOVERNMENT_COMPONENT_GROUP) as ComponentType[]
);

const INSTITUTION_FIELDS: Array<{ key: keyof GovernmentInstitutions; label: string }> = [
  { key: "headOfStateTitle", label: "Head of state" },
  { key: "headOfGovernmentTitle", label: "Head of government" },
  { key: "legislatureName", label: "Legislature" },
  { key: "executiveName", label: "Cabinet" },
  { key: "judicialName", label: "Highest court" },
];

/** Every interacting pair among the chosen components. */
export function interactingPairs(types: readonly ComponentType[]): SynergyPair[] {
  const pairs: SynergyPair[] = [];
  types.forEach((a, index) => {
    for (const b of types.slice(index + 1)) {
      const pair = findSynergyPair(a, b);
      if (pair) pairs.push(pair);
    }
  });
  return pairs;
}

function pairLine(pair: SynergyPair): string {
  const verb = pair.type === "CONFLICTING" ? "works against" : "works with";
  return `${componentName(pair.a)} ${verb} ${componentName(pair.b).toLowerCase()}: ${pair.description}`;
}

interface GovernmentStepProps {
  government: FoundingDraft["government"];
  onChooseForm: (formId: GovernmentFormId) => void;
  onToggleComponent: (type: ComponentType) => void;
  onRename: (key: keyof GovernmentInstitutions, value: string) => void;
  onResetComponents: () => void;
  /** Replaces the component set with a policy preset's, in one update. */
  onApplyPreset: (components: ComponentType[]) => void;
}

/** "How is your nation governed?": a recognisable form, then optional institution detail. */
export const GovernmentStep = forwardRef<HTMLDivElement, GovernmentStepProps>(
  function GovernmentStep(
    { government, onChooseForm, onToggleComponent, onRename, onResetComponents, onApplyPreset },
    headingRef
  ) {
    const [open, setOpen] = useState(() => isGovernmentCustomised(government));
    const chosen = useMemo(() => activeComponents(government), [government]);
    const institutions = activeInstitutions(government);
    const pairs = useMemo(() => interactingPairs(chosen), [chosen]);
    const conflicts = pairs.filter((pair) => pair.type === "CONFLICTING");
    const synergies = pairs.filter((pair) => pair.type !== "CONFLICTING");
    const plural = (count: number, one: string, many: string) =>
      count === 1 ? one : `${count} ${many}`;
    const signalTitle =
      conflicts.length > 0
        ? `${plural(conflicts.length, "One pair works", "pairs work")} against each other`
        : `${plural(synergies.length, "One pair works", "pairs work")} well together`;
    const atCap = chosen.length >= MAX_GOVERNMENT_COMPONENTS;
    const form = getGovernmentForm(government.formId);

    return (
      <StepCard
        ref={headingRef}
        id="founding-government"
        icon={<Bank />}
        title="How is your nation governed?"
        description="Pick the form closest to what you have in mind. It sets your leaders' titles and a working set of institutions."
      >
        <RadioCardGroup
          id="founding-government-choice"
          aria-labelledby="founding-government-title"
          value={government.formId}
          onValueChange={(value) => onChooseForm(value as GovernmentFormId)}
          columns={2}
        >
          {GOVERNMENT_FORMS.map((option) => (
            <RadioCard
              key={option.id}
              value={option.id}
              title={option.name}
              description={option.description}
            />
          ))}
        </RadioCardGroup>

        <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-5">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="group self-start">
              Customise institutions
              <NavArrowDown
                aria-hidden
                className="ease-out-facet transition-transform duration-150 group-data-[state=open]:rotate-180"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-6">
            <section className="flex flex-col gap-3" aria-labelledby="founding-institutions">
              <h3 id="founding-institutions" className="text-headline text-label">
                Names and titles
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {INSTITUTION_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex flex-col gap-2">
                    <Label htmlFor={`founding-institution-${key}`} className="text-subhead">
                      {label}
                    </Label>
                    <Input
                      id={`founding-institution-${key}`}
                      value={institutions[key]}
                      placeholder={form?.institutions[key]}
                      onChange={(event) => onRename(key, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            </section>

            <PolicyPresetPicker
              idPrefix="founding"
              currentChoices={government.components ?? []}
              onApply={(components) => onApplyPreset(components)}
              componentName={componentName}
            />

            <section className="flex flex-col gap-4" aria-labelledby="founding-components">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="founding-components" className="text-headline text-label">
                  Institutions
                </h3>
                <p className="text-footnote text-label-secondary tabular-nums" aria-live="polite">
                  {chosen.length} of {MAX_GOVERNMENT_COMPONENTS} chosen
                </p>
              </div>
              {pairs.length > 0 && (
                <Signal tone={conflicts.length > 0 ? "warning" : "success"} title={signalTitle}>
                  <ul className="flex flex-col gap-1">
                    {[...conflicts, ...synergies].map((pair) => (
                      <li key={`${pair.a}-${pair.b}`}>{pairLine(pair)}</li>
                    ))}
                  </ul>
                  {conflicts.length > 0 && (
                    <p className="mt-2">
                      Pairs that work against each other both weaken. You can still continue.
                    </p>
                  )}
                </Signal>
              )}
              {atCap && (
                <p className="text-footnote text-label-secondary">
                  You have chosen the most institutions a nation can hold. Remove one to add
                  another.
                </p>
              )}
              {government.components !== null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={onResetComponents}
                >
                  Use the {form?.name.toLowerCase() ?? "form"}&apos;s set
                </Button>
              )}
              {PICKER_GROUPS.map(({ group, components }) => (
                <div key={group} className="flex flex-col gap-1">
                  <h4 className="text-subhead text-label-secondary">{group}</h4>
                  <ul className="flex flex-col">
                    {components.map((type) => {
                      const checked = chosen.includes(type);
                      const id = `founding-component-${type}`;
                      return (
                        <li key={type} className="flex items-start gap-3 py-2">
                          <Checkbox
                            id={id}
                            checked={checked}
                            disabled={!checked && atCap}
                            onCheckedChange={() => onToggleComponent(type)}
                            aria-describedby={`${id}-effect`}
                            className="mt-1"
                          />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <Label htmlFor={id} className="text-body">
                              {componentName(type)}
                            </Label>
                            <p id={`${id}-effect`} className="text-footnote text-label-secondary">
                              {getComponentEffect(type)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          </CollapsibleContent>
        </Collapsible>
      </StepCard>
    );
  }
);
