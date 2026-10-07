"use client";

import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ALLIANCE_TYPES,
  SYNC_FIELD_LABELS,
  type NationOverride,
  type SyncField,
} from "~/lib/realms/sources/config";
import type { SyncSummary } from "~/lib/realms/sources/summary";
import { RunStatusBadge, type OverrideActions, type SourceSyncView, type SyncRun } from "./SourceSyncPanel";

const figure = (value: string | number | null | undefined) =>
  typeof value === "number"
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : (value ?? "none");

/** One collapsible list of the diff, with its count. */
function DiffSection({
  title,
  count,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <details open={defaultOpen} className="border-separator rounded-row border">
      <summary className="text-label text-body flex cursor-pointer items-center gap-2 px-3 py-2">
        <span className="font-medium">{title}</span>
        <Badge>{count}</Badge>
        {hint && <span className="text-label-secondary text-footnote">{hint}</span>}
      </summary>
      <div className="border-separator border-t px-3 py-2">{children}</div>
    </details>
  );
}

/** Match a source key to a country of the realm, by hand. */
function MatchPicker({
  countries,
  candidates,
  onMatch,
  disabled,
}: {
  countries: SourceSyncView["countries"];
  candidates?: string[];
  onMatch: (countryId: string) => void;
  disabled: boolean;
}) {
  const preferred = candidates?.length ? countries.filter((c) => candidates.includes(c.id)) : [];
  const rest = countries.filter((c) => !candidates?.includes(c.id));
  return (
    <Select onValueChange={onMatch} disabled={disabled}>
      <SelectTrigger className="h-(--control-height-sm) w-48" aria-label="Match to a nation">
        <SelectValue placeholder="Match to a nation" />
      </SelectTrigger>
      <SelectContent>
        {[...preferred, ...rest].map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
            {c.claimed ? " (claimed)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A run's diff: new nations, figure changes, borders, alliances, nations the source no longer lists, and the
 * cases left to staff, with the decisions staff can take on each (match by hand, exclude, pin a field, set an
 * alliance's type). Decisions apply to the next run.
 */
export function SyncDiffView({
  run,
  overrides,
  config,
  countries,
}: {
  run: SyncRun;
  overrides: OverrideActions;
  config: SourceSyncView["config"];
  countries: SourceSyncView["countries"];
}) {
  const summary = run.summary as SyncSummary;
  const [showAllBorders, setShowAllBorders] = useState(false);
  const nationOverrides = config?.overrides.nations ?? {};
  const organizationOverrides = config?.overrides.organizations ?? {};
  const decide = (key: string, patch: Partial<NationOverride>) =>
    overrides.nation(key, { ...nationOverrides[key], ...patch });
  const pin = (key: string, field: SyncField) =>
    decide(key, { lockedFields: [...new Set([...(nationOverrides[key]?.lockedFields ?? []), field])] });
  const c = summary.counts;
  const decided = Object.entries(nationOverrides);

  return (
    <section className="border-separator bg-surface rounded-card flex flex-col gap-3 border p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-label text-headline">{run.dryRun ? "Dry run" : "Applied run"}</h3>
        <RunStatusBadge status={run.status} />
        <span className="text-label-secondary text-footnote">{new Date(run.startedAt).toLocaleString()}</span>
      </div>
      <p className="text-label-secondary text-footnote">
        {c.sourceNations} source nations: {c.matched} matched, {c.create} new, {c.update} with changed figures,{" "}
        {c.unmatched} left to you, {c.missing} no longer in the source. Borders: {c.features} to write,{" "}
        {summary.featuresUnchanged} unchanged. Alliances: {c.alliances} to write.
      </p>
      {summary.applied && (
        <p className="text-label text-footnote">
          Written: {summary.applied.created} nations created, {summary.applied.updated} updated,{" "}
          {summary.applied.features} borders, {summary.applied.alliancesCreated} alliances created,{" "}
          {summary.applied.alliancesUpdated} updated, {summary.applied.membersAdded} members added.
          {summary.applied.infoboxEmpty.length > 0 &&
            ` The wiki gave nothing for ${summary.applied.infoboxEmpty.length} new nations (${summary.applied.infoboxEmpty.join(", ")}): run again later to retry.`}
        </p>
      )}

      <DiffSection title="Left to you" count={summary.unmatched.length} defaultOpen hint="nothing is guessed">
        <ul className="divide-separator divide-y">
          {summary.unmatched.map((u) => (
            <li key={u.key} className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-label text-body">{u.name}</span>
              <span className="text-label-secondary text-footnote font-mono">{u.key}</span>
              <span className="text-label-secondary text-footnote basis-full">
                {u.reason}
                {u.candidates.length > 0 && `: ${u.candidates.map((x) => x.name).join(", ")}`}
              </span>
              <MatchPicker
                countries={countries}
                candidates={u.candidates.flatMap((x) => (x.countryId ? [x.countryId] : []))}
                onMatch={(countryId) => decide(u.key, { countryId, exclude: undefined })}
                disabled={overrides.pending}
              />
              <Button
                size="xs"
                variant="ghost"
                disabled={overrides.pending}
                onClick={() => decide(u.key, { exclude: true })}
              >
                Exclude
              </Button>
            </li>
          ))}
        </ul>
      </DiffSection>

      <DiffSection title="New nations (unclaimed)" count={summary.creates.length}>
        <ul className="divide-separator divide-y">
          {summary.creates.map((n) => (
            <li key={n.key ?? n.name} className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-label text-body">{n.name}</span>
              <Badge variant="outline">{n.from === "roster" ? "roster page" : "source"}</Badge>
              <span className="text-label-secondary text-footnote">
                population {figure(n.population)} · GDP per capita {figure(n.gdpPerCapita)} · area{" "}
                {figure(n.landArea)} km² · {n.continent ?? "continent unknown"}
                {n.readInfobox && " · wiki infobox fills the rest"}
              </span>
              {n.key && (
                <span className="ml-auto flex items-center gap-2">
                  <MatchPicker
                    countries={countries}
                    onMatch={(countryId) => decide(n.key!, { countryId })}
                    disabled={overrides.pending}
                  />
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={overrides.pending}
                    onClick={() => decide(n.key!, { exclude: true })}
                  >
                    Exclude
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </DiffSection>

      <DiffSection title="Figure changes" count={summary.updates.filter((u) => u.changes.length).length}>
        <ul className="divide-separator divide-y">
          {summary.updates
            .filter((u) => u.changes.length > 0)
            .map((u) => (
              <li key={u.countryId} className="flex flex-col gap-1 py-2">
                <span className="text-label text-body">
                  {u.name} {u.claimed && <Badge variant="warning">claimed</Badge>}
                </span>
                {u.changes.map((ch) => (
                  <span key={ch.field} className="text-label-secondary text-footnote flex items-center gap-2">
                    {SYNC_FIELD_LABELS[ch.field]}: {figure(ch.from)} to {figure(ch.to)}
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={overrides.pending}
                      onClick={() => pin(u.key, ch.field)}
                    >
                      Pin current value
                    </Button>
                  </span>
                ))}
              </li>
            ))}
        </ul>
      </DiffSection>

      <DiffSection
        title="Claimed nations left alone"
        count={summary.skippedClaimed.length}
        hint="turn on Update claimed nations to overwrite"
      >
        <ul className="text-label-secondary text-footnote flex flex-col gap-1">
          {summary.skippedClaimed.map((s) => (
            <li key={s.countryId}>
              {s.name}: {s.fields.map((f) => SYNC_FIELD_LABELS[f]).join(", ")}
            </li>
          ))}
        </ul>
      </DiffSection>

      <DiffSection title="Borders" count={summary.features.length}>
        <ul className="text-label-secondary text-footnote flex flex-col gap-1">
          {(showAllBorders ? summary.features : summary.features.slice(0, 20)).map((f) => (
            <li key={f.key}>
              {f.action === "create" ? "New" : f.action === "update" ? "Changed" : "Linked"}: {f.key}
              {f.nation ? ` to ${f.nation}` : " (no nation, imported unlinked)"}
            </li>
          ))}
        </ul>
        {summary.features.length > 20 && !showAllBorders && (
          <Button size="xs" variant="ghost" onClick={() => setShowAllBorders(true)}>
            Show all {summary.features.length}
          </Button>
        )}
      </DiffSection>

      <DiffSection title="Alliances" count={summary.alliances.length + summary.unknownMembers.length}>
        <ul className="divide-separator divide-y">
          {summary.alliances.map((a) => (
            <li key={a.key} className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-label text-body">
                {a.name}
                {a.shortName && ` (${a.shortName})`}
              </span>
              <Badge variant="outline">{a.isNew ? "new" : `update: ${a.changes.join(", ") || "members"}`}</Badge>
              <Select
                value={organizationOverrides[a.key]?.type ?? a.type ?? undefined}
                onValueChange={(type) =>
                  overrides.organization(a.key, {
                    ...organizationOverrides[a.key],
                    type: type as (typeof ALLIANCE_TYPES)[number],
                  })
                }
                disabled={overrides.pending}
              >
                <SelectTrigger className="h-(--control-height-sm) w-36" aria-label={`Type of ${a.name}`}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {ALLIANCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="xs"
                variant="ghost"
                disabled={overrides.pending}
                onClick={() => overrides.organization(a.key, { ...organizationOverrides[a.key], exclude: true })}
              >
                Exclude
              </Button>
              {a.addMembers.length > 0 && (
                <span className="text-label-secondary text-footnote basis-full">Adds {a.addMembers.join(", ")}</span>
              )}
              {a.notInSource.length > 0 && (
                <span className="text-label-secondary text-footnote basis-full">
                  Members in IxStats only (kept): {a.notInSource.join(", ")}
                </span>
              )}
            </li>
          ))}
          {summary.unknownMembers.map((m) => (
            <li key={`${m.organization}:${m.member}`} className="text-label-secondary text-footnote py-2">
              {m.organization}: member {m.member} skipped. {m.reason}.
            </li>
          ))}
        </ul>
      </DiffSection>

      <DiffSection title="No longer in the source" count={summary.missing.length} hint="never deleted">
        <ul className="text-label-secondary text-footnote flex flex-col gap-1">
          {summary.missing.map((m) => (
            <li key={m.countryId}>
              {m.name} (was {m.key})
            </li>
          ))}
        </ul>
      </DiffSection>

      <DiffSection title="Your decisions" count={decided.length + Object.keys(organizationOverrides).length}>
        <ul className="divide-separator divide-y">
          {decided.map(([key, o]) => (
            <li key={key} className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-label text-footnote font-mono">{key}</span>
              <span className="text-label-secondary text-footnote">
                {[
                  o.exclude && "excluded",
                  o.countryId && `matched to ${countries.find((x) => x.id === o.countryId)?.name ?? o.countryId}`,
                  o.lockedFields?.length && `pinned: ${o.lockedFields.map((f) => SYNC_FIELD_LABELS[f]).join(", ")}`,
                ]
                  .filter(Boolean)
                  .join("; ")}
              </span>
              <Button
                size="xs"
                variant="ghost"
                className="ml-auto"
                disabled={overrides.pending}
                onClick={() => overrides.nation(key, null)}
              >
                Clear
              </Button>
            </li>
          ))}
          {Object.entries(organizationOverrides).map(([key, o]) => (
            <li key={`org:${key}`} className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-label text-footnote font-mono">{key}</span>
              <span className="text-label-secondary text-footnote">
                {[o.exclude && "excluded", o.type && `type ${o.type}`].filter(Boolean).join("; ")}
              </span>
              <Button
                size="xs"
                variant="ghost"
                className="ml-auto"
                disabled={overrides.pending}
                onClick={() => overrides.organization(key, null)}
              >
                Clear
              </Button>
            </li>
          ))}
        </ul>
      </DiffSection>

      <DiffSection title="Warnings" count={summary.warnings.length + (summary.applied?.errors.length ?? 0)}>
        <ul className="text-label-secondary text-footnote flex flex-col gap-1">
          {(summary.applied?.errors ?? []).map((e) => (
            <li key={e} className="text-destructive-ink">
              {e}
            </li>
          ))}
          {summary.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </DiffSection>
    </section>
  );
}
