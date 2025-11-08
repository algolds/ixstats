"use client";

import { Crosshair, Package, Factory, Database } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function MilitaryEquipmentArticle() {
  return (
    <ArticleLayout
      title="Military Equipment Catalog"
      description="Browse and manage 500+ military equipment items across all domains with detailed specifications, manufacturers, and acquisition options."
      icon={Crosshair}
    >
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
            Catalog managed via <code>smallArmsEquipment</code> router with 12 procedures for CRUD
            operations.
          </li>
        </ul>
      </Section>

      <Section title="API Integration">
        <InfoBox title="Equipment Routers">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <code>api.militaryEquipment.getAll</code> – Browse full catalog with filters (type,
              origin, era, capabilities).
            </li>
            <li>
              <code>api.militaryEquipment.getById</code> – Detailed specs for specific equipment
              item.
            </li>
            <li>
              <code>api.militaryEquipment.getManufacturers</code> – List all equipment manufacturers
              and production facilities.
            </li>
            <li>
              <code>api.smallArmsEquipment.getAll</code> – Infantry weapons catalog with caliber,
              weight, rate of fire.
            </li>
            <li>
              <code>api.security.getForceComposition</code> – View equipped units and inventory
              levels.
            </li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Admin Management">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Military Equipment Catalog:</strong> <code>/admin/military-equipment</code> –
            Main interface for equipment CRUD, specifications, capabilities, variants.
          </li>
          <li>
            <strong>Manufacturers:</strong> <code>/admin/military-equipment/manufacturers</code> –
            Dedicated interface for managing defense contractors, production facilities, origin
            countries, capabilities, license agreements, and active status.
          </li>
          <li>
            <strong>Small Arms:</strong> <code>/admin/military-equipment/small-arms</code> –
            Specialized interface for infantry weapons with caliber, rate of fire, weight, and
            ammunition specs.
          </li>
          <li>
            <strong>Analytics:</strong> <code>/admin/military-equipment/analytics</code> – Usage
            statistics, popular equipment, manufacturer activity, catalog health metrics.
          </li>
          <li>
            <strong>Bulk Operations:</strong> Import equipment/manufacturer data from CSV, batch
            update specs, standardize nomenclature.
          </li>
          <li>
            All changes logged to audit trail; requires ADMIN or MILITARY_ADMIN role.
          </li>
        </ul>
      </Section>

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
            <code>/help/admin/reference-data</code> – Managing equipment catalogs via admin CMS.
          </li>
          <li>
            <Package className="inline h-4 w-4" /> <code>/help/defense/units</code> – Assigning
            equipment to military units.
          </li>
          <li>
            <Database className="inline h-4 w-4" />{" "}
            <code>docs/reference/api-complete.md</code> – Full militaryEquipment and
            smallArmsEquipment router documentation.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
