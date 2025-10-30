"use client";

import { Layers, FolderTree, Server } from "lucide-react";
import { ArticleLayout, Section, InfoBox } from "../../_components/ArticleLayout";

export default function TechnicalArchitectureArticle() {
  return (
    <ArticleLayout
      title="System Architecture"
      description="High-level overview of the Next.js, tRPC, and Prisma stack that powers IxStats."
      icon={Layers}
    >
      <Section title="Key Layers">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Frontend:</strong> Next.js App Router + React 19 (`src/app`, `src/components`).
          </li>
          <li>
            <strong>API:</strong> tRPC routers in `src/server/api/routers` with shared
            context/middleware.
          </li>
          <li>
            <strong>Data:</strong> Prisma schema (`prisma/schema.prisma`) with SQLite/PostgreSQL
            support.
          </li>
          <li>
            <strong>Realtime:</strong> Custom WebSocket server in `src/lib/websocket-server.ts`
            (production).
          </li>
        </ul>
      </Section>

      <Section title="Repository Map">
        <InfoBox title="Where Things Live">
          <ul className="list-disc space-y-1 pl-6">
            <li>`docs/overview/feature-map.md` – high-level inventory.</li>
            <li>
              `docs/architecture/frontend.md` / `backend.md` / `data.md` – deep dives per layer.
            </li>
            <li>`src/lib` & `src/services` – shared utilities and orchestration services.</li>
          </ul>
        </InfoBox>
      </Section>

      <Section title="Extending the Architecture">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Add new features by co-locating UI, routers, and docs; ensure tests cover new behaviour.
          </li>
          <li>
            Update `/help/technical/api` and `/help/technical/database` when APIs or schema change.
          </li>
          <li>Keep legacy docs in `docs/archive/v1` for historical reference.</li>
        </ul>
      </Section>

      <InfoBox title="Related Documentation">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <FolderTree className="inline h-4 w-4" /> `README.md` – quick start & project structure.
          </li>
          <li>
            <Server className="inline h-4 w-4" /> `docs/operations/deployment.md` – production
            guidance.
          </li>
        </ul>
      </InfoBox>
    </ArticleLayout>
  );
}
