"use client";

import React from "react";
import { Bank, CheckCircle, Group, MapPin, PageEdit, Percentage, TaskList } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { useNotify } from "~/hooks/useNotify";
import { shouldShowFirstSteps, type FirstStepId } from "~/lib/mycountry/first-steps";
import { api } from "~/trpc/react";

const STEPS: Record<FirstStepId, { title: string; todo: string; Icon: typeof Bank }> = {
  budget: {
    title: "Review your budget",
    todo: "See what each department gets in the National budget.",
    Icon: Bank,
  },
  tax: {
    title: "Set your tax policy",
    todo: "Choose your income, corporate and sales tax rates.",
    Icon: Percentage,
  },
  cabinet: {
    title: "Appoint your cabinet",
    todo: "Name the ministers who run your government.",
    Icon: Group,
  },
  wiki: {
    title: "Write your wiki page",
    todo: "Start your nation's article on IxWiki.",
    Icon: PageEdit,
  },
  capital: {
    title: "Place your capital on the map",
    todo: "Mark your capital city in the map editor.",
    Icon: MapPin,
  },
};

const TITLE_ID = "first-steps-title";

/**
 * MyCountry overview: what a newly founded nation sets up next, each step linking to the console
 * that owns it and ticking itself from that console's data. Renders nothing for an established
 * nation, once every step is done, or after the owner hides it.
 */
export function FirstStepsCard({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const input = { countryId };
  const { data } = api.mycountry.getFirstSteps.useQuery(input, {
    enabled: !!countryId,
    // A visitor viewing someone else's nation gets FORBIDDEN; the card simply stays away.
    retry: false,
  });

  const hide = api.mycountry.dismissFirstSteps.useMutation({
    onMutate: () => {
      utils.mycountry.getFirstSteps.setData(input, (old) =>
        old ? { ...old, dismissed: true } : old
      );
    },
    onError: (error) => {
      notify.error("Couldn't hide first steps", error.message);
      void utils.mycountry.getFirstSteps.invalidate(input);
    },
  });

  if (!shouldShowFirstSteps(data)) return null;

  const doneCount = data.items.filter((item) => item.done).length;

  return (
    <Card role="region" aria-labelledby={TITLE_ID} padding="md">
      <CardHeader className="flex-row items-start justify-between gap-3 px-0 pb-3">
        <div className="min-w-0">
          <CardTitle id={TITLE_ID} icon={<TaskList />} role="heading" aria-level={2}>
            First steps
          </CardTitle>
          <CardDescription className="mt-1 tabular-nums">
            {doneCount} of {data.items.length} done
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={hide.isPending}
          onClick={() => hide.mutate(input)}
        >
          Hide
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <FacetList variant="plain">
          <FacetListSection aria-label="First steps">
            {data.items.map((item) => {
              const step = STEPS[item.id];
              return (
                <FacetRow
                  key={item.id}
                  href={item.href}
                  leading={
                    item.done ? (
                      <CheckCircle aria-hidden className="text-success size-5" />
                    ) : (
                      <step.Icon aria-hidden className="size-5" />
                    )
                  }
                  title={step.title}
                  subtitle={item.done ? "Done" : step.todo}
                />
              );
            })}
          </FacetListSection>
        </FacetList>
      </CardContent>
    </Card>
  );
}
