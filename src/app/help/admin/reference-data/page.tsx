"use client";

import Link from "next/link";
import { FolderTree, Edit } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function ReferenceDataArticle() {
  return (
    <ArticleLayout
      title="Reference Data Management"
      description="Create, edit, and organize game content catalogs including government components, economic policies, military equipment, and diplomatic scenarios."
      icon={FolderTree}
    >
      <ContentCard>
        <Section title="Government Components">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>24 Atomic Components:</strong> DEMOCRATIC_PROCESS, FEDERAL_SYSTEM,
              CONSTITUTIONAL_MONARCHY, etc.
            </li>
            <li>
              <strong>Fields:</strong> Name, description, category, effectiveness score (0-100),
              tier requirements.
            </li>
            <li>
              <strong>Synergies:</strong> Define compatible components that boost effectiveness when
              combined.
            </li>
            <li>
              <strong>Conflicts:</strong> Mark incompatible combinations that reduce effectiveness
              or cause instability.
            </li>
            <li>Changes immediately reflected in the country builder component selector.</li>
          </ul>
        </Section>

        <Section title="Economic Components">
          <InfoBox title="40+ Policy Components">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Categories: Trade Policy, Labor Market, Investment, Innovation, Infrastructure,
                Environment.
              </li>
              <li>
                Effects: GDP impact, employment, innovation index, sustainability, inequality.
              </li>
              <li>Prerequisites: Tier requirements, prerequisite components, unlock conditions.</li>
              <li>Formulas: Custom calculation expressions for dynamic economic modeling.</li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Tax System Components">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>42 Tax Types:</strong> Income, corporate, VAT, property, capital gains, etc.
            </li>
            <li>
              <strong>Rate Configuration:</strong> Min/max rates, progressive brackets, flat rates,
              exemptions.
            </li>
            <li>
              <strong>Revenue Formulas:</strong> Base calculations with GDP multipliers, population
              factors, compliance rates.
            </li>
            <li>
              <strong>Economic Effects:</strong> Growth impact, inequality adjustments, compliance
              costs.
            </li>
          </ul>
        </Section>

        <Section title="Diplomatic Scenarios">
          <InfoBox title="100+ Scenario Templates">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Categories:</strong> Trade, cultural, security, crisis mediation, alliances.
              </li>
              <li>
                <strong>Triggers:</strong> Relationship thresholds, random probability,
                event-driven.
              </li>
              <li>
                <strong>Response Options:</strong> 2-5 choices with costs, benefits, NPC personality
                modifiers.
              </li>
              <li>
                <strong>Outcomes:</strong> Relationship changes, economic effects, reputation
                shifts, resource transfers.
              </li>
            </ul>
          </InfoBox>
        </Section>

        <Section title="Military Equipment">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>500+ Equipment Items:</strong> Tanks, aircraft, ships, artillery, small arms.
            </li>
            <li>
              <strong>Specifications:</strong> Weight, crew, range, speed, armament, protection
              levels.
            </li>
            <li>
              <strong>Manufacturers:</strong> Origin country, production dates, license agreements.
            </li>
            <li>
              <strong>Operational Data:</strong> Maintenance costs, reliability, upgrade paths.
            </li>
          </ul>
        </Section>

        <Section title="NPC Personalities">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>8 Personality Traits:</strong> Assertiveness, cooperativeness, risk tolerance,
              pragmatism, etc.
            </li>
            <li>
              <strong>Calculation Formulas:</strong> Define how traits derive from observable data
              (alliances, conflicts, trade).
            </li>
            <li>
              <strong>Archetypes:</strong> Configure 6 personality profiles (Pragmatist, Idealist,
              Aggressor, etc.).
            </li>
            <li>
              <strong>Drift Parameters:</strong> Max annual change rates, influence factors.
            </li>
          </ul>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="CRUD Operations">
          <InfoBox title="Standard Admin Workflow">
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                <strong>Create:</strong> Click &quot;New [Type]&quot; button, fill form, validate,
                save to database.
              </li>
              <li>
                <strong>Read:</strong> Browse list view with filters, search, pagination; click to
                view details.
              </li>
              <li>
                <strong>Update:</strong> Edit inline or via form; changes logged to audit trail.
              </li>
              <li>
                <strong>Delete:</strong> Soft delete (archived) or hard delete with confirmation;
                check dependencies first.
              </li>
            </ol>
          </InfoBox>
        </Section>

        <Section title="Bulk Operations">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>CSV Import:</strong> Upload spreadsheet with standardized columns; preview
              before commit.
            </li>
            <li>
              <strong>Batch Edit:</strong> Select multiple items, apply common changes (tags,
              categories, effectiveness scores).
            </li>
            <li>
              <strong>Export:</strong> Download current catalog as CSV or JSON for backup or
              external analysis.
            </li>
            <li>
              <strong>Validation:</strong> Automatic checks for duplicates, invalid references,
              missing required fields.
            </li>
          </ul>
        </Section>

        <InfoBox title="Related Articles">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Edit className="inline h-4 w-4" />{" "}
              <Link
                href="/help/admin/cms-overview"
                className="text-blue-400 underline hover:text-blue-300"
              >
                Admin CMS Overview
              </Link>{" "}
              -- Admin system architecture and capabilities.
            </li>
            <li>
              A rich, interconnected data model sits behind every content type you manage.
            </li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
