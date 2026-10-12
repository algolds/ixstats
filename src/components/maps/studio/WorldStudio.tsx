"use client";

import { useMemo } from "react";
import { useUser } from "~/context/auth-context";
import { useWideScreen } from "~/hooks/useWideScreen";
import { isIxnaySlug } from "~/lib/realms/realm-ids";
import { FACTORY_STUDIO_PRESETS, studioPresets } from "~/lib/worldgen/studio-presets";
import { createWorldWorker } from "~/lib/worldgen/worker/create-world-worker";
import type { WorldWorkerFactory } from "~/lib/worldgen/worker/world-messages";
import { api } from "~/trpc/react";
import type { StudioRealm } from "./StudioContext";
import { StudioPhoneNotice } from "./StudioPhoneNotice";
import { StudioWorkspace } from "./StudioWorkspace";

interface WorldStudioProps {
  /** `?fit=<realm slug>`: start fitted to that realm */
  fit?: string | null;
  /** Starts the generator's worker; tests pass a fake */
  createWorker?: WorldWorkerFactory;
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-label-secondary flex h-full items-center justify-center gap-3 p-6 text-center">
      {children}
    </div>
  );
}

/** Reads the presets and the realms the Studio starts from, and waits for the presets (the recipe starts from one). */
function StudioLoader({ fit, createWorker }: Required<WorldStudioProps>) {
  const { user } = useUser();
  const presetsQuery = api.atlas.presets.list.useQuery(undefined, { retry: 1 });
  const realmsQuery = api.atlas.realms.overview.useQuery(undefined, { retry: 1 });

  const presets = useMemo(
    () => (presetsQuery.data ? studioPresets(presetsQuery.data) : null),
    [presetsQuery.data]
  );
  const realms = useMemo<StudioRealm[]>(
    () =>
      (realmsQuery.data?.realms ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        mapVersion: row.mapVersion,
        hasPolitical: !row.layers.missing.includes("political"),
        isIxnay: isIxnaySlug(row.slug),
      })),
    [realmsQuery.data]
  );

  if (!user) return <Message>Loading the Studio.</Message>;
  if (!presets && !presetsQuery.isError) return <Message>Loading the presets.</Message>;
  const fallback = !presets;
  return (
    <StudioWorkspace
      userId={user.id}
      presets={presets ?? FACTORY_STUDIO_PRESETS}
      presetsFallback={fallback}
      realms={realms}
      realmsState={realmsQuery.isError ? "failed" : realmsQuery.data ? "ready" : "loading"}
      fitParam={fit}
      createWorker={createWorker}
    />
  );
}

/**
 * World Studio: the full-screen generator workbench. Below about 900 px it is a notice with the way back, and
 * nothing else is mounted (no queries, no map, no worker).
 */
export default function WorldStudio({
  fit = null,
  createWorker = createWorldWorker,
}: WorldStudioProps) {
  const wide = useWideScreen();
  if (!wide) return <StudioPhoneNotice />;
  return <StudioLoader fit={fit} createWorker={createWorker} />;
}
