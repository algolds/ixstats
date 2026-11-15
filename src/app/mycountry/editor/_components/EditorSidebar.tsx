"use client";

import {
  Bank,
  Coins,
  Globe,
  Group,
  Map as MapIcon,
  MapPin,
  NavArrowRight,
  StatsReport,
  Wallet,
  WhiteFlag,
} from "iconoir-react";
import { Card } from "~/components/ui/card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { MYCOUNTRY_MAP_EDITOR_PATH, type EditorPane } from "~/lib/mycountry/routes";
import { cn } from "~/lib/utils/cn";
import { useEditor } from "./editor-context";

export interface StudioPaneDefinition {
  id: EditorPane;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  dirtySectionIds: readonly string[];
}

export interface StudioGroupDefinition {
  id: string;
  label: string;
  panes: readonly StudioPaneDefinition[];
}

export const STUDIO_GROUPS: readonly StudioGroupDefinition[] = [
  {
    id: "nation",
    label: "Nation",
    panes: [
      {
        id: "identity",
        title: "Identity and symbols",
        subtitle: "Name, flag, capital, culture and civic codes",
        icon: <WhiteFlag />,
        dirtySectionIds: ["name", "symbols", "language", "culture", "civic"],
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    panes: [
      {
        id: "constitution",
        title: "Constitution and legislature",
        subtitle: "Form of state, chambers and institutions",
        icon: <Bank />,
        dirtySectionIds: ["form", "legislature", "institutions"],
      },
      {
        id: "cabinet",
        title: "Cabinet and parties",
        subtitle: "Ministers and registered political parties",
        icon: <Group />,
        dirtySectionIds: ["cabinet", "parties"],
      },
    ],
  },
  {
    id: "economy",
    label: "Economy",
    panes: [
      {
        id: "scale",
        title: "Population and baselines",
        subtitle: "Population, GDP per capita and macro figures",
        icon: <StatsReport />,
        dirtySectionIds: ["population", "figures"],
      },
      {
        id: "taxes",
        title: "Taxes and tariffs",
        subtitle: "National tax rates and sector tariffs",
        icon: <Coins />,
        dirtySectionIds: ["taxes", "tariffs"],
      },
      {
        id: "budget",
        title: "Departments and budget",
        subtitle: "Department shares and fiscal year allocations",
        icon: <Wallet />,
        dirtySectionIds: ["budget"],
      },
    ],
  },
];

export const ALL_STUDIO_PANES: readonly StudioPaneDefinition[] = STUDIO_GROUPS.flatMap(
  (group) => group.panes
);

export function EditorSidebar({
  activePane,
  slug,
  onSelectPane,
  className,
}: {
  activePane: EditorPane;
  slug: string | null;
  onSelectPane: (pane: EditorPane) => void;
  className?: string;
}) {
  const { dirty } = useEditor();
  const dirtyIds = new Set(dirty.map((item) => item.id));

  return (
    <nav
      aria-label="Editor sections"
      className={cn("lg:sticky lg:top-20 lg:self-start", className)}
    >
      <Card variant="pane" content="navigation" padding="md">
        <FacetList variant="plain" className="gap-5">
          {STUDIO_GROUPS.map((group) => (
            <FacetListSection
              key={group.id}
              header={group.label}
              headerAs="h2"
              groupClassName="rounded-row overflow-hidden"
            >
              {group.panes.map((pane) => {
                const isSelected = activePane === pane.id;
                const isDirty = pane.dirtySectionIds.some((id) => dirtyIds.has(id));
                return (
                  <FacetRow
                    key={pane.id}
                    href={`#${pane.id}`}
                    leading={pane.icon}
                    title={pane.title}
                    subtitle={<span className="lg:hidden">{pane.subtitle}</span>}
                    selected={isSelected}
                    selectionStyle="tint"
                    aria-current={isSelected ? "location" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      onSelectPane(pane.id);
                    }}
                    trailing={
                      isDirty ? (
                        <span
                          aria-hidden
                          title="Unsaved changes"
                          className="bg-tint size-2 shrink-0 rounded-full"
                        />
                      ) : undefined
                    }
                    accessory={
                      <NavArrowRight
                        aria-hidden
                        className="text-label-tertiary size-4 shrink-0 lg:hidden"
                      />
                    }
                  />
                );
              })}
            </FacetListSection>
          ))}

          <FacetListSection
            header="Related workspaces"
            headerAs="h2"
            groupClassName="rounded-row overflow-hidden"
          >
            <FacetRow
              href={MYCOUNTRY_MAP_EDITOR_PATH}
              leading={<MapIcon />}
              title="Map editor"
              subtitle={<span className="lg:hidden">Territory, cities and capital placement</span>}
            />
            {slug && (
              <>
                <FacetRow
                  href={`/countries/${slug}`}
                  leading={<Globe />}
                  title="Public profile"
                  subtitle={<span className="lg:hidden">How other players see your nation</span>}
                />
                <FacetRow
                  href={`/countries/${slug}/map`}
                  leading={<MapPin />}
                  title="Geography"
                  subtitle={<span className="lg:hidden">Regions and story pins on the map</span>}
                />
              </>
            )}
          </FacetListSection>
        </FacetList>
      </Card>
    </nav>
  );
}
