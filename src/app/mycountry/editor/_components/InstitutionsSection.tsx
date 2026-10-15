"use client";

import { useState } from "react";
import type { ComponentType } from "@prisma/client";
import { NavArrowDown, Puzzle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Checkbox } from "~/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Signal } from "~/components/ui/signal";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import {
  getComponentEffect,
  getComponentGroup,
  groupComponentsByPlainGroup,
} from "~/lib/government/component-guide";
import {
  componentInteractions,
  governmentEffectiveness,
  projectComponentRecords,
  type ScoredComponent,
} from "~/lib/government/effectiveness";
import { MAX_DEFINED_COMPONENTS } from "~/lib/mycountry/editor-fields";
import { cn } from "~/lib/utils";
import { EditorSection, SaveButton, useSaveHandlers } from "./EditorSection";
import { useEditor, useReportDirty } from "./editor-context";

const DEFINED = Object.keys(ATOMIC_COMPONENTS) as ComponentType[];
const GROUPS = groupComponentsByPlainGroup(DEFINED);

/** "Centralized Power Structure" as "Centralized power structure"; acronyms stay. */
function sentenceCase(name: string): string {
  return name
    .split(" ")
    .map((word, i) => (i === 0 || /^[A-Z0-9-]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(" ");
}

export function componentName(type: string): string {
  const name = ATOMIC_COMPONENTS[type as ComponentType]?.name;
  return name ? sentenceCase(name) : sentenceCase(type.replace(/_/g, " ").toLowerCase());
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * Institutions (government components), grouped by plain heading with one line each on what they
 * do. Pairs that help or hurt each other show in one Signal, and the line under the list says
 * what saving does to government effectiveness, from the same formula the save stores.
 */
export function InstitutionsSection({
  components,
  storedEffectiveness,
}: {
  components: ScoredComponent[];
  storedEffectiveness: number | null;
}) {
  const { countryId, getVersion } = useEditor();
  const savedTypes = [...new Set(components.map((c) => c.componentType))];
  const [selected, setSelected] = useState<string[]>(savedTypes);
  const dirty = !sameSet(selected, savedTypes);
  useReportDirty("institutions", "Institutions", dirty);

  // Components without a description (from older nations) stay as they are; they do not count.
  const undescribed = selected.filter((t) => !getComponentGroup(t as ComponentType));
  const definedCount = selected.length - undescribed.length;
  const atCap = definedCount >= MAX_DEFINED_COMPONENTS;
  const overCap = definedCount > MAX_DEFINED_COMPONENTS;

  const current = Math.round(storedEffectiveness ?? governmentEffectiveness(components));
  const projected = Math.round(
    governmentEffectiveness(projectComponentRecords(components, selected))
  );

  const interactions = componentInteractions(selected);
  const conflicts = interactions.filter((i) => i.type === "CONFLICTING");
  const synergies = interactions.filter((i) => i.type !== "CONFLICTING");

  const handlers = useSaveHandlers({
    saved: "Institutions saved",
    failed: "Could not save the institutions",
  });
  const save = api.countries.saveGovernmentComponents.useMutation(handlers);

  const toggle = (type: string, on: boolean) =>
    setSelected((s) => (on ? [...s, type] : s.filter((t) => t !== type)));

  return (
    <EditorSection
      id="institutions"
      title="Institutions"
      icon={<Puzzle />}
      description={`The building blocks of your government. Choose up to ${MAX_DEFINED_COMPONENTS}.`}
    >
      <p className="text-label text-callout tabular-nums" aria-live="polite">
        {definedCount} of {MAX_DEFINED_COMPONENTS} chosen
        {overCap && ". Remove some to save."}
      </p>

      {conflicts.length > 0 ? (
        <Signal
          tone="warning"
          title={
            conflicts.length === 1
              ? "1 pair works against each other"
              : `${conflicts.length} pairs work against each other`
          }
        >
          <ul className="flex flex-col gap-1">
            {conflicts.map((c) => (
              <li key={`${c.a}+${c.b}`}>
                {componentName(c.a)} and {componentName(c.b).toLowerCase()}: {c.description}
              </li>
            ))}
          </ul>
          {synergies.length > 0 && (
            <p className="mt-2">
              {synergies.length === 1
                ? "1 pair works well together."
                : `${synergies.length} pairs work well together.`}
            </p>
          )}
        </Signal>
      ) : synergies.length > 0 ? (
        <Signal
          tone="success"
          title={
            synergies.length === 1
              ? "1 pair works well together"
              : `${synergies.length} pairs work well together`
          }
        >
          <ul className="flex flex-col gap-1">
            {synergies.map((s) => (
              <li key={`${s.a}+${s.b}`}>
                {componentName(s.a)} and {componentName(s.b).toLowerCase()}: {s.description}
              </li>
            ))}
          </ul>
        </Signal>
      ) : null}

      <div className="flex flex-col gap-2">
        {GROUPS.map(({ group, components: types }) => {
          const chosen = types.filter((t) => selected.includes(t)).length;
          return (
            <Collapsible key={group} defaultOpen={chosen > 0}>
              <CollapsibleTrigger className="group/trigger rounded-row hover:bg-fill-4 focus-visible:outline-tint flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left outline-none focus-visible:outline-2">
                <span className="text-headline text-label">{group}</span>
                <span className="text-label-secondary text-footnote flex items-center gap-2 tabular-nums">
                  {chosen > 0 ? `${chosen} chosen` : "None chosen"}
                  <NavArrowDown
                    aria-hidden
                    className="duration-fast ease-out-facet size-4 transition-transform group-data-[state=open]/trigger:rotate-180"
                  />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="flex flex-col gap-1 py-1">
                  {types.map((type) => {
                    const checked = selected.includes(type);
                    const id = `editor-component-${type}`;
                    return (
                      <li key={type}>
                        <label
                          htmlFor={id}
                          className={cn(
                            "rounded-row hover:bg-fill-4 flex min-h-11 cursor-pointer items-start gap-3 px-3 py-2",
                            !checked && atCap && "cursor-not-allowed opacity-60"
                          )}
                        >
                          <Checkbox
                            id={id}
                            className="mt-0.5"
                            checked={checked}
                            disabled={!checked && atCap}
                            aria-describedby={`${id}-effect`}
                            onCheckedChange={(on) => toggle(type, on === true)}
                          />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-body text-label">{componentName(type)}</span>
                            <span
                              id={`${id}-effect`}
                              className="text-footnote text-label-secondary"
                            >
                              {getComponentEffect(type)}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {undescribed.length > 0 && (
        <p className="text-label-secondary text-footnote">
          {undescribed.length === 1
            ? "1 older institution without a description stays as it is."
            : `${undescribed.length} older institutions without a description stay as they are.`}
        </p>
      )}

      {dirty && (
        <p className="text-label text-callout tabular-nums" aria-live="polite">
          Government effectiveness: {current} → {projected}
        </p>
      )}

      <SaveButton
        label="Save institutions"
        dirty={dirty}
        invalid={overCap}
        pending={save.isPending}
        onSave={() =>
          save.mutate({
            countryId,
            expectedUpdatedAt: getVersion(),
            componentTypes: selected as ComponentType[],
          })
        }
      />
    </EditorSection>
  );
}
