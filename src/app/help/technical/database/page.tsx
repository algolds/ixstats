"use client";

import { Database } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function DatabaseArticle() {
  return (
    <ArticleLayout
      title="Database Schema"
      description="Understand how Prisma models map to gameplay domains and how to maintain migrations."
      icon={Database}
    >
      <ContentCard>
        <Section title="Schema Basics">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Prisma 6.19 schema with 209 models spanning economy, diplomacy, social, defense,
              cards, elections, and notifications.
            </li>
            <li>
              PostgreSQL in all environments with the PostGIS extension for geographic data.
              Migrated from SQLite in October 2025.
            </li>
            <li>Enums mirror TypeScript unions to keep routers and UI in sync.</li>
          </ul>
        </Section>

        <Section title="Working with Migrations">
          <InfoBox title="Migration Workflow">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Use Prisma migration commands to apply schema changes in development and production.
              </li>
              <li>Schema push is available for rapid iteration in development (use with care).</li>
              <li>Prisma Studio provides a visual interface to browse and edit data.</li>
              <li>PostgreSQL backups: Use standard PostgreSQL tools for snapshots and restores.</li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Tips for Contributors">
          <ul className="list-disc space-y-2 pl-6">
            <li>Co-locate schema changes with router updates and documentation.</li>
            <li>Seed sample data if new models need default values.</li>
            <li>Use PostgreSQL-specific features (PostGIS, full-text search) when beneficial.</li>
          </ul>
        </Section>

        <InfoBox title="Schema at a Glance">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>209 models</strong> organized into domain families: economy, diplomacy,
              defense, social, cards, elections, intelligence, and system administration.
            </li>
            <li>Prisma migration history tracks all schema evolution since the initial release.</li>
          </ul>
        </InfoBox>
      </ContentCard>
    </ArticleLayout>
  );
}
