/**
 * The stored form of a run (RealmSyncRun.summary, RealmSourceSync.lastSummary): the plan without geometry, and,
 * for an applied run, what was written. The settings page renders it as the diff.
 */
import type { NationRef, SyncPlan } from "./plan";

export interface AppliedResult {
  created: number;
  updated: number;
  features: number;
  alliancesCreated: number;
  alliancesUpdated: number;
  membersAdded: number;
  /**
   * Nations whose wiki infobox gave nothing (wiki unreachable, slow, or no infobox). A re-run reads each again
   * while it is unclaimed and still has no flag, coat of arms, leader or government.
   */
  infoboxEmpty: string[];
  /** Existing unclaimed nations a re-read infobox filled (only fields that were empty). */
  refilled: string[];
  errors: string[];
}

const refName = (ref: NationRef | null, names: ReadonlyMap<string, string>) =>
  !ref ? null : "newName" in ref ? ref.newName : (names.get(ref.countryId) ?? ref.countryId);

export function summarizePlan(plan: SyncPlan, countryNames: ReadonlyMap<string, string>) {
  return {
    counts: plan.counts,
    creates: plan.creates,
    updates: plan.updates,
    skippedClaimed: plan.skippedClaimed,
    locked: plan.locked,
    refills: plan.refills,
    features: plan.features.map((f) => ({
      key: f.key,
      action: f.action,
      nation: refName(f.nation, countryNames),
    })),
    featuresUnchanged: plan.featuresUnchanged,
    alliances: plan.alliances.map((a) => ({
      key: a.key,
      name: a.name,
      shortName: a.shortName,
      color: a.color,
      type: a.type,
      isNew: a.allianceId === null,
      changes: a.changes,
      addMembers: a.addMembers.map((m) => m.name),
      notInSource: a.notInSource,
    })),
    unknownMembers: plan.unknownMembers,
    missing: plan.missing,
    unmatched: plan.unmatched,
    excluded: plan.excluded,
    warnings: plan.warnings,
  };
}

export type SyncSummary = ReturnType<typeof summarizePlan> & { applied?: AppliedResult };

const figure = (value: string | number | null) =>
  typeof value === "number"
    ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : (value ?? "none");

/** The run as plain text lines (the script prints these). */
export function summaryLines(summary: SyncSummary): string[] {
  const c = summary.counts;
  const lines = [
    `source nations ${c.sourceNations}, matched ${c.matched}, new ${c.create}, changed ${c.update}, unmatched ${c.unmatched}, missing ${c.missing}`,
    `borders: ${summary.features.length} to write, ${summary.featuresUnchanged} unchanged; alliances: ${summary.alliances.length} to write`,
  ];
  for (const n of summary.creates)
    lines.push(
      `  new: ${n.name}${n.key ? ` [${n.key}]` : ""} (${n.from === "roster" ? "roster page" : "source"})` +
        ` pop ${figure(n.population)}, gdppc ${figure(n.gdpPerCapita)}, area ${figure(n.landArea)}, continent ${n.continent ?? "unknown"}`
    );
  for (const u of summary.updates) {
    const changes = u.changes
      .map((ch) => `${ch.field} ${figure(ch.from)} -> ${figure(ch.to)}`)
      .join("; ");
    lines.push(
      `  update: ${u.name} [${u.key}]${u.bindKey ? " (key stored)" : ""}${changes ? `: ${changes}` : ""}`
    );
  }
  for (const s of summary.skippedClaimed)
    lines.push(`  claimed, left alone: ${s.name} (${s.fields.join(", ")})`);
  for (const s of summary.locked)
    lines.push(`  pinned, left alone: ${s.name} (${s.fields.join(", ")})`);
  for (const r of summary.refills) lines.push(`  wiki infobox read again: ${r.name}`);
  for (const f of summary.features)
    lines.push(`  border ${f.action}: ${f.key}${f.nation ? ` -> ${f.nation}` : " (unlinked)"}`);
  for (const a of summary.alliances)
    lines.push(
      `  alliance ${a.isNew ? "new" : "update"}: ${a.name}${a.shortName ? ` (${a.shortName})` : ""}` +
        `${a.type ? ` ${a.type}` : ""}${a.addMembers.length ? `, adds ${a.addMembers.join(", ")}` : ""}` +
        `${a.notInSource.length ? `; in IxStats only: ${a.notInSource.join(", ")}` : ""}`
    );
  for (const m of summary.unknownMembers)
    lines.push(`  alliance member skipped: ${m.organization} / ${m.member}: ${m.reason}`);
  for (const m of summary.missing) lines.push(`  missing from the source: ${m.name} [${m.key}]`);
  for (const u of summary.unmatched)
    lines.push(
      `  UNMATCHED ${u.key} (${u.name}): ${u.reason}${u.candidates.length ? ` [${u.candidates.map((x) => x.name).join(", ")}]` : ""}`
    );
  if (summary.excluded.length) lines.push(`  excluded: ${summary.excluded.join(", ")}`);
  for (const w of summary.warnings) lines.push(`  warning: ${w}`);
  const applied = summary.applied;
  if (applied) {
    lines.push(
      `written: ${applied.created} nations created, ${applied.updated} updated, ${applied.features} borders, ` +
        `${applied.alliancesCreated} alliances created, ${applied.alliancesUpdated} updated, ${applied.membersAdded} members added`
    );
    if (applied.refilled.length)
      lines.push(`  wiki infobox filled: ${applied.refilled.join(", ")}`);
    if (applied.infoboxEmpty.length)
      lines.push(
        `  wiki infobox gave nothing (re-run to retry): ${applied.infoboxEmpty.join(", ")}`
      );
    for (const e of applied.errors) lines.push(`  ERROR ${e}`);
  }
  return lines;
}
