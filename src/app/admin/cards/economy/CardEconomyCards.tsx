"use client";
/** The Economy tab's card economy numbers: finishes, the daily card, dust, crafting and fusion, listings, card XP. */
import type { ReactNode } from "react";
import { CalendarCheck, Droplet, Hammer, Label, Palette, StatUp } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { CardEconomyConfig } from "~/lib/cards/economy-config";
import { ECONOMY_SECTIONS, type EconomySection } from "~/lib/cards/economy-fields";
import { NumberConfigCard } from "./NumberConfigCard";

const SECTION_ICONS: Record<EconomySection["id"], ReactNode> = {
  finishes: <Palette />,
  daily: <CalendarCheck />,
  dust: <Droplet />,
  crafting: <Hammer />,
  listings: <Label />,
  xp: <StatUp />,
};

export function CardEconomyCards({ initial }: { initial: CardEconomyConfig }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const save = api.cards.admin.economy.saveEconomy.useMutation({
    onSuccess: () => {
      notify.success("Economy numbers saved", "They apply within a minute.");
      void utils.cards.admin.economy.get.invalidate();
      // The players' crafting numbers read the same config
      void utils.crafting.getNumbers.invalidate();
    },
    onError: (error) => notify.error("Economy numbers not saved", error.message),
  });
  return (
    <>
      {ECONOMY_SECTIONS.map((section) => (
        <NumberConfigCard
          key={section.id}
          id={`economy-${section.id}`}
          title={section.title}
          icon={SECTION_ICONS[section.id]}
          description={section.description}
          fields={section.fields}
          initial={initial}
          saveLabel={section.saveLabel}
          pending={save.isPending}
          onSave={(changed) => save.mutate(changed)}
          check={section.check}
        />
      ))}
    </>
  );
}
