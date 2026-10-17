"use client";
/** The cards admin (cards refresh spec §2.4): nine flat tabs, the active one in `?tab=`. */
import { useState, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "~/components/shell/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { usePageTitle } from "~/hooks/usePageTitle";
import { CARDS_ADMIN_TABS, cardsAdminTabFromParam, type CardsAdminTab } from "./cards-admin-tabs";
import { OverviewTab } from "./overview";
import { LibraryTab } from "./library";
import { ImportsTab } from "./imports";
import { CurationTab } from "./curation";
import { PacksTab } from "./packs";
import { EconomyTab } from "./economy";
import { SeasonsTab } from "./seasons";
import { ComplianceTab } from "./compliance";
import { DesignerTab } from "./designer";

const PANELS: Record<CardsAdminTab, ComponentType> = {
  overview: OverviewTab,
  library: LibraryTab,
  imports: ImportsTab,
  curation: CurationTab,
  packs: PacksTab,
  economy: EconomyTab,
  seasons: SeasonsTab,
  compliance: ComplianceTab,
  designer: DesignerTab,
};

export default function CardsPanel() {
  usePageTitle({ title: "Admin - Cards" });
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<CardsAdminTab>(() =>
    cardsAdminTabFromParam(searchParams.get("tab"), searchParams.get("subtab"))
  );

  const select = (value: string) => {
    const next = cardsAdminTabFromParam(value);
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    url.searchParams.delete("subtab");
    window.history.pushState({}, "", url.toString());
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Cards" />
      <Tabs value={tab} onValueChange={select} className="w-full">
        <TabsList
          aria-label="Cards administration"
          className="bg-fill-3 rounded-row flex w-full flex-wrap justify-start gap-1 p-1"
        >
          {CARDS_ADMIN_TABS.map(({ id, label }) => (
            <TabsTrigger key={id} value={id} className="text-caption">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {CARDS_ADMIN_TABS.map(({ id }) => {
          const Panel = PANELS[id];
          return (
            <TabsContent key={id} value={id} className="mt-4 focus-visible:outline-none">
              <Panel />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
