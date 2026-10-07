"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SOURCE_FORMATS } from "~/lib/realms/sources/adapters";
import {
  DEFAULT_SYNC_OPTIONS,
  MAX_SYNC_INTERVAL_HOURS,
  SYNC_INTERVAL_PRESETS,
  type RealmSyncOptions,
} from "~/lib/realms/sources/config";
import { SOURCE_PRESETS } from "~/lib/realms/sources/presets";
import { ContinentTable } from "./ContinentTable";
import type { SourceSyncView } from "./SourceSyncPanel";

const OPTION_LABELS: Array<{ key: keyof RealmSyncOptions; label: string; hint: string }> = [
  { key: "addNewNations", label: "Add new nations", hint: "Create unclaimed nations for source entries no nation matches." },
  { key: "addRosterNations", label: "Add roster nations", hint: "Create unclaimed nations for the lore index's nation pages the source does not list." },
  { key: "useWikiInfobox", label: "Read new nations' wiki infobox", hint: "Fill what the source lacks, plus flag, arms, leader and identity. Slow: one page at a time." },
  { key: "updateUnclaimedStats", label: "Update unclaimed nations", hint: "Population, GDP per capita, land area, capital, official name and continent." },
  { key: "updateClaimedStats", label: "Update claimed nations too", hint: "Overwrites players' own figures with the source's. Leave off unless the realm wants that." },
  { key: "updateBorders", label: "Update borders", hint: "Write the source's borders into the realm's map and link them to their nations." },
  { key: "syncAlliances", label: "Sync alliances", hint: "Create the source's organisations as alliances and add their listed members." },
  { key: "applyContinents", label: "Apply continents", hint: "Set nations' continents from the table below." },
];

type IntervalChoice = "off" | "custom" | `${number}`;

function intervalChoice(hours: number | null): IntervalChoice {
  if (hours === null) return "off";
  return SYNC_INTERVAL_PRESETS.some((p) => p.hours === hours) ? (`${hours}` as IntervalChoice) : "custom";
}

/** Where the realm's nations come from, what a run may change, the schedule and the continent table. */
export function SourceSettingsForm({
  slug,
  view,
  onSaved,
}: {
  slug: string;
  view: SourceSyncView;
  onSaved: () => void;
}) {
  const notify = useNotify();
  const config = view.config;
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [repo, setRepo] = useState(config?.repo ?? "");
  const [ref, setRef] = useState(config?.ref ?? "main");
  const [format, setFormat] = useState(config?.format ?? SOURCE_FORMATS[0]?.id ?? "");
  const [settingsText, setSettingsText] = useState(JSON.stringify(config?.settings ?? {}, null, 2));
  const [interval, setIntervalChoice] = useState<IntervalChoice>(intervalChoice(config?.intervalHours ?? null));
  const [customHours, setCustomHours] = useState(String(config?.intervalHours ?? 48));
  const [options, setOptions] = useState<RealmSyncOptions>(config?.options ?? DEFAULT_SYNC_OPTIONS);
  const [continents, setContinents] = useState<Record<string, string>>(config?.continentMap ?? {});
  const [presetId, setPresetId] = useState(config?.presetId ?? SOURCE_PRESETS[0]?.id ?? "");

  const save = api.realms.sourceSync.save.useMutation({
    onSuccess: () => {
      notify.success("Source sync saved");
      onSaved();
    },
    onError: (e) => notify.error("Could not save", e.message),
  });
  const loadPreset = api.realms.sourceSync.loadPreset.useMutation({
    onSuccess: () => {
      notify.success("Preset loaded", "Its values are now this realm's settings; edit them as you like.");
      onSaved();
    },
    onError: (e) => notify.error("Could not load the preset", e.message),
  });

  const submit = () => {
    let settings: Record<string, unknown>;
    try {
      const parsed = JSON.parse(settingsText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      settings = parsed as Record<string, unknown>;
    } catch {
      notify.error("Source settings are not valid JSON", "Fix the settings box and save again.");
      return;
    }
    const custom = Math.round(Number(customHours));
    const intervalHours =
      interval === "off" ? null : interval === "custom" ? custom : Number(interval);
    if (intervalHours !== null && !(intervalHours >= 1 && intervalHours <= MAX_SYNC_INTERVAL_HOURS)) {
      notify.error("Schedule", `Choose 1 to ${MAX_SYNC_INTERVAL_HOURS} hours.`);
      return;
    }
    save.mutate({
      slug,
      config: {
        enabled,
        provider: "github",
        repo: repo.trim(),
        ref: ref.trim(),
        format,
        settings,
        intervalHours,
        options,
        continentMap: continents,
        // Staff decisions are saved as they are made (the diff's lists); keep the stored ones.
        overrides: config?.overrides ?? { nations: {}, organizations: {} },
      },
    });
  };

  return (
    <section className="border-separator bg-surface rounded-card flex flex-col gap-5 border p-4 md:p-6">
      <div>
        <h3 className="text-label text-headline">Source</h3>
        <p className="text-label-secondary text-footnote">
          A public GitHub repository the realm&apos;s nations, figures, borders and alliances are read from.
          Every value below belongs to this realm; a preset only fills them in.
        </p>
      </div>

      <div className="bg-fill-4 rounded-row flex flex-wrap items-end gap-3 p-3">
        <div className="flex min-w-56 flex-col gap-1">
          <Label htmlFor="sync-preset">Preset</Label>
          <Select value={presetId} onValueChange={setPresetId}>
            <SelectTrigger id="sync-preset">
              <SelectValue placeholder="Choose a preset" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!presetId || loadPreset.isPending}
          onClick={() => loadPreset.mutate({ slug, presetId })}
        >
          Load preset
        </Button>
        <p className="text-label-secondary text-footnote basis-full">
          Loading replaces the repository, file paths, field names, options and continent table with the
          preset&apos;s; the schedule switch and your per-nation decisions stay.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="sync-repo">Repository (owner/repo)</Label>
          <Input id="sync-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sync-ref">Branch, tag or commit</Label>
          <Input id="sync-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sync-format">Format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger id="sync-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_FORMATS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="sync-settings">Source settings (JSON)</Label>
        <Textarea
          id="sync-settings"
          value={settingsText}
          onChange={(e) => setSettingsText(e.target.value)}
          rows={10}
          spellCheck={false}
          className="text-footnote font-mono"
        />
        <p className="text-label-secondary text-footnote">
          File paths in the repository, the names of the bindings and fields to read, the wiki the nations&apos;
          pages are on and its link prefixes, the alliance type rules and the map attribution line. Checked
          when you save.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sync-interval">Schedule</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={interval} onValueChange={(v) => setIntervalChoice(v as IntervalChoice)}>
              <SelectTrigger id="sync-interval" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Manual only</SelectItem>
                {SYNC_INTERVAL_PRESETS.map((p) => (
                  <SelectItem key={p.hours} value={`${p.hours}`}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {interval === "custom" && (
              <Input
                type="number"
                min={1}
                max={MAX_SYNC_INTERVAL_HOURS}
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                aria-label="Hours between runs"
                className="w-28"
              />
            )}
            {interval === "custom" && <span className="text-label-secondary text-footnote">hours</span>}
          </div>
        </div>
        <label className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Run on the schedule" />
          <span className="text-label text-body">Run on the schedule</span>
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-label text-headline mb-2">What a run may change</legend>
        {OPTION_LABELS.map(({ key, label, hint }) => (
          <label key={key} className="flex items-start gap-3">
            <Switch
              checked={options[key] as boolean}
              onCheckedChange={(checked) => setOptions((o) => ({ ...o, [key]: checked }))}
              aria-label={label}
            />
            <span className="flex flex-col">
              <span className="text-label text-body">{label}</span>
              <span
                className={
                  key === "updateClaimedStats" && options.updateClaimedStats
                    ? "text-warning-ink text-footnote"
                    : "text-label-secondary text-footnote"
                }
              >
                {hint}
              </span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-3">
          <Switch
            checked={options.missingNations === "flag"}
            onCheckedChange={(checked) =>
              setOptions((o) => ({ ...o, missingNations: checked ? "flag" : "ignore" }))
            }
            aria-label="List nations the source no longer has"
          />
          <span className="flex flex-col">
            <span className="text-label text-body">List nations the source no longer has</span>
            <span className="text-label-secondary text-footnote">
              Shown in the run&apos;s diff. A nation is never deleted by a sync.
            </span>
          </span>
        </label>
      </fieldset>

      <ContinentTable value={continents} onChange={setContinents} />

      <div className="flex justify-end">
        <Button disabled={save.isPending || !repo.trim()} onClick={submit}>
          {save.isPending ? "Saving…" : "Save source sync"}
        </Button>
      </div>
    </section>
  );
}
