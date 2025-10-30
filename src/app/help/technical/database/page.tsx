"use client";

import { Database, GitBranch, HardDrive } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function DatabaseArticle() {
  return (
    <ArticleLayout
      title="Database Schema"
      description="Understand how Prisma models map to gameplay domains and how to maintain migrations."
      icon={Database}
    >
      <Section title="Schema Basics">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Prisma schema (`prisma/schema.prisma`) defines 131 models across economy, diplomacy,
            social, defense, and notifications.
          </li>
          <li>
            PostgreSQL in all environments (`localhost:5433/ixstats` for development) with PostGIS
            extension for geographic data.
          </li>
          <li>
            Migration Note (October 2025): Migrated from SQLite to PostgreSQL for better performance
            and spatial features.
          </li>
          <li>Enums mirror TypeScript unions to keep routers and UI in sync.</li>
        </ul>
      </Section>

      <Section title="Working with Migrations">
        <InfoBox title="Commands">
          <ul className="list-disc space-y-1 pl-6">
            <li>`npm run db:migrate` / `npm run db:migrate:deploy` – apply migrations.</li>
            <li>`npm run db:push` – sync schema quickly in dev (use with care).</li>
            <li>`npm run db:studio` – open Prisma Studio to browse data.</li>
            <li>PostgreSQL backups: Use `pg_dump` and standard PostgreSQL tools.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Tips for Contributors">
        <ul className="list-disc space-y-2 pl-6">
          <li>Co-locate schema changes with router updates and documentation.</li>
          <li>Seed sample data if new models need default values (see `scripts/setup`).</li>
          <li>Use PostgreSQL-specific features (PostGIS, full-text search) when beneficial.</li>
          <li>Update `docs/architecture/data.md` for new model families or schema changes.</li>
        </ul>
      </Section>

      <InfoBox title="Reference Material">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <GitBranch className="inline h-4 w-4" /> Prisma migration history under
            `prisma/migrations`.
          </li>
          <li>
            <HardDrive className="inline h-4 w-4" /> `docs/operations/environments.md` – environment
            variable requirements.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
