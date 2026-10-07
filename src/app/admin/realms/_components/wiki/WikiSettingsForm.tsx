"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  MAX_KEYWORD_LENGTH,
  MAX_MAP_CATEGORIES,
  MAX_TITLE_LENGTH,
  type RealmWikiSettings,
  type RealmWikiSource,
} from "~/lib/realms/realm-wiki-settings";
import type { RealmWikiView } from "./RealmWikiPanel";

interface FormValues {
  source: RealmWikiSource;
  rootCategory: string;
  keyword: string;
  rosterCategory: string;
  portalTitle: string;
  mapCategories: string;
}

function toForm(wiki: RealmWikiSettings | null, fallbackSource: RealmWikiSource): FormValues {
  return {
    source: wiki?.source ?? fallbackSource,
    rootCategory: wiki?.rootCategory ?? "",
    keyword: wiki?.keyword ?? "",
    rosterCategory: wiki?.rosterCategory ?? "",
    portalTitle: wiki?.portalTitle ?? "",
    mapCategories: (wiki?.mapCategories ?? []).join("\n"),
  };
}

const FIELDS: Array<{ key: Exclude<keyof FormValues, "source" | "mapCategories">; label: string; placeholder: string; hint: string }> = [
  {
    key: "rootCategory",
    label: "Root category",
    placeholder: "Category:Eurth",
    hint: "The category tree the lore import crawls.",
  },
  {
    key: "keyword",
    label: "Keyword",
    placeholder: "Eurth",
    hint: "Only subcategories whose title contains it are followed.",
  },
  {
    key: "rosterCategory",
    label: "Nation roster category",
    placeholder: "Category:Countries (Eurth)",
    hint: "One subcategory or page per nation. Leave empty to find nations by their infobox (slower, capped).",
  },
  {
    key: "portalTitle",
    label: "Portal page",
    placeholder: "Portal:Eurth",
    hint: "Its images are offered as world maps.",
  },
];

/** The realm's wiki settings: which sister wiki, and how its world is found there. */
export function WikiSettingsForm({ slug, view }: { slug: string; view: RealmWikiView }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const fallbackSource = view.sources[0]?.id ?? "iiwiki";
  const [values, setValues] = useState<FormValues>(toForm(view.wiki, fallbackSource));
  const [presetId, setPresetId] = useState(view.presets[0]?.id ?? "");
  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));

  const save = api.realms.wiki.save.useMutation({
    onSuccess: ({ wiki }) => {
      notify.success(wiki ? "Wiki settings saved" : "Wiki settings cleared");
      void utils.realms.wiki.get.invalidate({ slug });
    },
    onError: (e) => notify.error("Could not save the wiki settings", e.message),
  });

  const submit = () =>
    save.mutate({
      slug,
      wiki: {
        source: values.source,
        rootCategory: values.rootCategory,
        keyword: values.keyword,
        rosterCategory: values.rosterCategory.trim() || null,
        portalTitle: values.portalTitle.trim() || null,
        mapCategories: values.mapCategories
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      },
    });

  const preset = view.presets.find((p) => p.id === presetId);

  return (
    <section className="border-separator bg-surface rounded-card flex flex-col gap-5 border p-4 md:p-6">
      <div>
        <h3 className="text-label text-headline">Wiki</h3>
        <p className="text-label-secondary text-footnote">
          The wiki the realm&apos;s lore lives on and how its world is found there. The lore import and
          discovery read these; a wiki not listed here can&apos;t be used.
        </p>
      </div>

      {view.presets.length > 0 && (
        <div className="bg-fill-4 rounded-row flex flex-wrap items-end gap-3 p-3">
          <div className="flex min-w-56 flex-col gap-1">
            <Label htmlFor="wiki-preset">Preset</Label>
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger id="wiki-preset">
                <SelectValue placeholder="Choose a preset" />
              </SelectTrigger>
              <SelectContent>
                {view.presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!preset}
            onClick={() => preset && setValues(toForm(preset.wiki, fallbackSource))}
          >
            Fill from preset
          </Button>
          <p className="text-label-secondary text-footnote basis-full">
            Fills the form only; nothing is saved until you press Save.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="wiki-source">Wiki</Label>
          <Select value={values.source} onValueChange={(source) => set({ source: source as RealmWikiSource })}>
            <SelectTrigger id="wiki-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {view.sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <Label htmlFor={`wiki-${field.key}`}>{field.label}</Label>
            <Input
              id={`wiki-${field.key}`}
              value={values[field.key]}
              onChange={(e) => set({ [field.key]: e.target.value })}
              placeholder={field.placeholder}
              maxLength={field.key === "keyword" ? MAX_KEYWORD_LENGTH : MAX_TITLE_LENGTH}
            />
            <p className="text-label-secondary text-footnote">{field.hint}</p>
          </div>
        ))}
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label htmlFor="wiki-map-categories">Map categories (optional, one per line)</Label>
          <Textarea
            id="wiki-map-categories"
            value={values.mapCategories}
            onChange={(e) => set({ mapCategories: e.target.value })}
            rows={2}
            placeholder="Category:Maps of Eurth"
          />
          <p className="text-label-secondary text-footnote">
            Up to {MAX_MAP_CATEGORIES}. &quot;Category:Maps of &lt;keyword&gt;&quot;, &quot;Category:&lt;keyword&gt;
            maps&quot; and the root&apos;s map subcategories are always searched.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {view.wiki && (
          <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ slug, wiki: null })}>
            Clear
          </Button>
        )}
        <Button
          disabled={save.isPending || !values.rootCategory.trim() || !values.keyword.trim()}
          onClick={submit}
        >
          {save.isPending ? "Saving…" : "Save wiki settings"}
        </Button>
      </div>
    </section>
  );
}
