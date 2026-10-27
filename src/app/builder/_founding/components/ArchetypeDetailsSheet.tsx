"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { getEconomicComponentDisplay } from "~/lib/economy/data/display";
import type { ArchetypeOption } from "../lib/founding-archetypes";
import { archetypeFacts } from "../lib/founding-archetypes";

interface ArchetypeDetailsSheetProps {
  option: ArchetypeOption | null;
  onOpenChange: (open: boolean) => void;
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-headline text-label">{title}</h3>
      <ul className="text-callout text-label-secondary flex list-disc flex-col gap-1 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** One archetype in full: what it fills, the country it is calibrated on, strengths and trade-offs. */
export function ArchetypeDetailsSheet({ option, onOpenChange }: ArchetypeDetailsSheetProps) {
  const economy = option
    ? option.data.economicComponents.flatMap((type) => {
        const display = getEconomicComponentDisplay(type);
        return display ? [`${display.name}: ${display.effect}`] : [];
      })
    : [];
  return (
    <Sheet open={option !== null} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        {option && (
          <div className="flex flex-col gap-6 pb-6">
            <SheetHeader>
              <SheetTitle>{option.display.displayName}</SheetTitle>
              <SheetDescription>
                {option.display.inspiration}. {option.display.pitch}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-6">
              <Section title="What it fills" items={[...archetypeFacts(option), ...economy]} />
              <Section
                title="Calibrated on"
                items={[`${option.data.region}. Its starting economy follows this benchmark.`]}
              />
              <Section title="Strengths" items={option.data.strengths} />
              <Section title="Trade-offs" items={option.data.challenges} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
