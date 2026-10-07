"use client";

import { api, type RouterOutputs } from "~/trpc/react";
import { ChosenWikiMap } from "./ChosenWikiMap";
import { WikiDiscoveryPanel } from "./WikiDiscoveryPanel";
import { WikiSettingsForm } from "./WikiSettingsForm";

export type RealmWikiView = RouterOutputs["realms"]["wiki"]["get"];

/** Bytes as KB or MB, for file sizes. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * A realm's wiki: the sister wiki its lore lives on and how its world is found there, discovery of its nations and
 * candidate world maps, and the map chosen from it. Shown in /admin/realms (site admins) and in the realm's
 * Manage tab (its founder).
 */
export function RealmWikiPanel({ slug }: { slug: string }) {
  const { data: view, isLoading, error } = api.realms.wiki.get.useQuery({ slug }, { retry: false });

  if (isLoading) return <p className="text-label-secondary text-body">Loading the wiki settings…</p>;
  if (!view) return <p className="text-label-secondary text-body">{error?.message ?? "Not available."}</p>;

  return (
    <div className="flex flex-col gap-6">
      <WikiSettingsForm key={JSON.stringify(view.wiki)} slug={slug} view={view} />
      {view.map && <ChosenWikiMap slug={slug} map={view.map} />}
      {view.wiki ? (
        <WikiDiscoveryPanel key={JSON.stringify(view.wiki)} slug={slug} view={view} />
      ) : (
        <p className="text-label-secondary text-footnote">
          Save the realm&apos;s wiki settings to discover its nations and world maps.
        </p>
      )}
    </div>
  );
}
