"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import { ArticleLayout, Section, InfoBox, ContentCard } from "../../_components/ArticleLayout";

export default function TechnicalArchitectureArticle() {
  return (
    <ArticleLayout
      title="System Architecture"
      description="High-level overview of the Next.js, tRPC, and Prisma stack that powers IxStats."
      icon={Layers}
    >
      <ContentCard>
        <Section title="Key Layers">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Frontend:</strong> Next.js 16.1.3 App Router + React 19.1.3 with 640+ total
              components across the application.
            </li>
            <li>
              <strong>API:</strong> 61 tRPC routers (927 endpoints) with rate limiting middleware.
            </li>
            <li>
              <strong>Data:</strong> Prisma 6.19 schema (209 models) with PostgreSQL + PostGIS in
              all environments.
            </li>
            <li>
              <strong>Caching:</strong> Redis for rate limiting and session management.
            </li>
            <li>
              <strong>Realtime:</strong> Custom WebSocket server for live updates in production.
            </li>
          </ul>
        </Section>

        <Section title="Layer Overview">
          <InfoBox title="How the Layers Connect">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                The frontend communicates with the API layer exclusively through type-safe tRPC
                hooks.
              </li>
              <li>
                The API layer handles authentication, rate limiting, and business logic before
                accessing the database through Prisma.
              </li>
              <li>
                Shared utilities and orchestration services coordinate cross-cutting concerns.
              </li>
            </ul>
          </InfoBox>
        </Section>
      </ContentCard>

      <ContentCard>
        <Section title="Extending the Architecture">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Add new features by co-locating UI, routers, and documentation; ensure tests cover new
              behaviour.
            </li>
            <li>
              Update the{" "}
              <Link
                href="/help/technical/api"
                className="text-blue-400 underline hover:text-blue-300"
              >
                API reference
              </Link>{" "}
              and{" "}
              <Link
                href="/help/technical/database"
                className="text-blue-400 underline hover:text-blue-300"
              >
                database schema
              </Link>{" "}
              articles when APIs or schema change.
            </li>
          </ul>
        </Section>
      </ContentCard>
    </ArticleLayout>
  );
}
