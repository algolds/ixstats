"use client";

import Link from "next/link";
import { Crosshair, Package, Factory } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function MilitaryEquipmentArticle() {
  return (
    <ArticleLayout
      title="Military Equipment Catalog"
      description="Browse and manage 500+ military equipment items across all domains with detailed specifications, manufacturers, and acquisition options."
      icon={Crosshair}
    >
      <ContentCard>
        <Section title="Equipment Categories">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Ground Forces:</strong> Main battle tanks, armored vehicles, artillery systems,
              air defense platforms, infantry weapons (500+ items).
            </li>
            <li>
              <strong>Naval Forces:</strong> Aircraft carriers, destroyers, submarines, patrol craft,
              amphibious vessels, support ships.
            </li>
            <li>
              <strong>Air Forces:</strong> Fighter jets, bombers, helicopters, transport aircraft,
              reconnaissance platforms, drones.
            </li>
            <li>
              <strong>Support Systems:</strong> Communications, logistics, medical, engineering,
              intelligence equipment.
            </li>
          </ul>
        </Section>

        <Section title="Equipment Data & Specifications">
          <InfoBox title="What the Catalog Includes">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Technical Specs:</strong> Weight, dimensions, crew size, range, speed,
                armament, protection levels.
              </li>
              <li>
                <strong>Manufacturer Info:</strong> Origin country, production dates, variants,
                license production agreements.
              </li>
              <li>
                <strong>Operational Data:</strong> Maintenance costs, fuel consumption, reliability
                ratings, upgrade paths.
              </li>
              <li>
                <strong>Acquisition Options:</strong> Purchase, license production, joint development,
                leasing, donations.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Small Arms Equipment">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Infantry Weapons:</strong> Rifles, carbines, designated marksman rifles, sniper
              systems, machine guns.
            </li>
            <li>
              <strong>Crew-Served Weapons:</strong> Heavy machine guns, mortars, anti-tank guided
              missiles, man-portable air defense.
            </li>
            <li>
              <strong>Sidearms & Special:</strong> Pistols, submachine guns, shotguns, grenade
              launchers, less-lethal systems.
            </li>
            <li>
              The full small arms catalog is searchable with detailed specifications for every item.
            </li>
          </ul>
        </Section>

        <Section title="How to Browse Equipment">
          <InfoBox title="Browsing & Filtering">
            <ul className="list-disc space-y-1 pl-6">
              <li>Browse the full catalog with filters by type, origin country, era, and capabilities.</li>
              <li>View detailed specs for any specific equipment item.</li>
              <li>Search manufacturers and production facilities.</li>
              <li>Browse infantry weapons by caliber, weight, and rate of fire.</li>
              <li>See your currently equipped units and inventory levels.</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard fullWidth>
        <Section title="Integration with Defense Systems">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Equipment selections drive force composition calculations in MyCountry defense
              dashboards.
            </li>
            <li>
              Acquisition costs feed into budget system; maintenance expenses affect operating
              budgets.
            </li>
            <li>
              Equipment capabilities determine readiness scores and operational effectiveness
              ratings.
            </li>
            <li>
              Link equipment to specific military branches, units, and deployment zones for
              comprehensive tracking.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Documentation">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Factory className="inline h-4 w-4" />{" "}
              <Link href="/help/admin/reference-data" className="text-blue-600 hover:underline dark:text-blue-400">Reference Data Management</Link>{" "}
              — Managing equipment catalogs (admin).
            </li>
            <li>
              <Package className="inline h-4 w-4" />{" "}
              <Link href="/help/defense/units" className="text-blue-600 hover:underline dark:text-blue-400">Military Units & Assets</Link>{" "}
              — Assigning equipment to military units.
            </li>
            <li>
              <Crosshair className="inline h-4 w-4" />{" "}
              <Link href="/help/defense/customization" className="text-blue-600 hover:underline dark:text-blue-400">Force Customization</Link>{" "}
              — Tailoring your forces with the right equipment.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
