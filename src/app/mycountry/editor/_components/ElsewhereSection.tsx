"use client";

import {
  Coins,
  Group,
  Map as MapIcon,
  MapPin,
  Percentage,
  StatsReport,
  Wallet,
} from "iconoir-react";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import {
  MYCOUNTRY_BUDGET_PATH,
  MYCOUNTRY_CABINET_PATH,
  MYCOUNTRY_ECONOMY_PATH,
  MYCOUNTRY_MAP_EDITOR_PATH,
  MYCOUNTRY_TAX_PATH,
} from "~/lib/mycountry/routes";
import { EditorSection } from "./EditorSection";

/** Where the live numbers are set: the editor links there instead of editing them. */
export function ElsewhereSection({ slug }: { slug: string | null }) {
  return (
    <EditorSection
      id="consoles"
      title="Managed elsewhere"
      icon={<Wallet />}
      description="Budget, taxes, cabinet and economic policy are set in their own MyCountry consoles."
    >
      <FacetList variant="plain">
        <FacetListSection aria-label="Consoles">
          <FacetRow
            leading={<Coins />}
            title="Budget"
            subtitle="Spending by department"
            href={MYCOUNTRY_BUDGET_PATH}
          />
          <FacetRow
            leading={<Percentage />}
            title="Tax policy"
            subtitle="Tax rates and revenue"
            href={MYCOUNTRY_TAX_PATH}
          />
          <FacetRow
            leading={<Group />}
            title="Cabinet"
            subtitle="Ministers and appointments"
            href={MYCOUNTRY_CABINET_PATH}
          />
          <FacetRow
            leading={<StatsReport />}
            title="Economy"
            subtitle="Growth, trade and policy levers"
            href={MYCOUNTRY_ECONOMY_PATH}
          />
          {slug && (
            <FacetRow
              leading={<MapPin />}
              title="Geography"
              subtitle="Land, regions and transport in your factbook"
              href={`/countries/${slug}/factbook/geography`}
            />
          )}
          <FacetRow
            leading={<MapIcon />}
            title="Map"
            subtitle="Territory, cities and your capital's place"
            href={MYCOUNTRY_MAP_EDITOR_PATH}
          />
        </FacetListSection>
      </FacetList>
    </EditorSection>
  );
}
