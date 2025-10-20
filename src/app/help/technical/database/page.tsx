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
        <ul className="list-disc pl-6 space-y-2">
          <li>Prisma schema (`prisma/schema.prisma`) defines 131 models across economy, diplomacy, social, defense, and notifications.</li>
          <li>SQLite in development (`file:./prisma/dev.db`) and SQLite/PostgreSQL in production.</li>
          <li>Enums mirror TypeScript unions to keep routers and UI in sync.</li>
        </ul>
      </Section>

      <Section title="Working with Migrations">
        <InfoBox title="Commands">
          <ul className="list-disc pl-6 space-y-1">
            <li>`npm run db:migrate` / `npm run db:migrate:deploy` – apply migrations.</li>
            <li>`npm run db:push` – sync schema quickly in dev (use with care).</li>
            <li>`npm run db:backup` / `restore` – manage SQLite backups.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Tips for Contributors">
        <ul className="list-disc pl-6 space-y-2">
          <li>Co-locate schema changes with router updates and documentation.</li>
          <li>Seed sample data if new models need default values (see `scripts/setup`).</li>
          <li>Update `docs/reference/database.md` for new model families.</li>
        </ul>
      </Section>

      <InfoBox title="Reference Material">
        <ul className="list-disc pl-6 space-y-1">
          <li><GitBranch className="inline h-4 w-4" /> Prisma migration history under `prisma/migrations`.</li>
          <li><HardDrive className="inline h-4 w-4" /> `docs/operations/environments.md` – environment variable requirements.</li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
