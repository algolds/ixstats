"use client";
/** The daily lore import, per wiki: on or off, and how many pages a day wait in Curation. */
import { useState } from "react";
import { Calendar } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  CARD_ARTICLE_SOURCES,
  cardSourceLabel,
  type CardArticleSource,
} from "~/lib/cards/card-sources";
import { dailyImportCountField, numberFieldProblem } from "~/lib/cards/economy-fields";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { fieldNumber } from "./NumberConfigCard";

interface Setting {
  enabled: boolean;
  count: number;
}

function SourceRow({ source, initial }: { source: CardArticleSource; initial: Setting }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [draft, setDraft] = useState<{ enabled?: boolean; count?: string }>({});
  const save = api.cards.admin.economy.saveDailyImport.useMutation({
    onSuccess: () => {
      notify.success("Daily import saved");
      void utils.cards.admin.economy.get.invalidate();
    },
    onError: (error) => notify.error("Daily import not saved", error.message),
  });
  const label = cardSourceLabel(source);
  const field = dailyImportCountField(label);
  const enabled = draft.enabled ?? initial.enabled;
  const rawCount = draft.count ?? String(initial.count);
  const count = fieldNumber(rawCount);
  const problem = numberFieldProblem(field, count);
  const changed = enabled !== initial.enabled || count !== initial.count;
  const problemId = `daily-${source}-problem`;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3">
        <Switch
          aria-label={`Import from ${label} daily`}
          checked={enabled}
          onCheckedChange={(on) => setDraft((current) => ({ ...current, enabled: on }))}
        />
        <span className="text-callout text-label min-w-40">{label}</span>
        <Input
          aria-label={field.label}
          aria-invalid={problem !== null}
          aria-describedby={problem ? problemId : undefined}
          type="number"
          min={field.min}
          max={field.max}
          step={1}
          value={rawCount}
          onChange={(event) => setDraft((current) => ({ ...current, count: event.target.value }))}
          className="w-24 tabular-nums"
        />
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Save ${label} daily import`}
          disabled={save.isPending || problem !== null || !changed}
          onClick={() => save.mutate({ source, setting: { enabled, count } })}
        >
          Save
        </Button>
      </div>
      {problem && (
        <p id={problemId} className="text-destructive text-footnote">
          {problem}
        </p>
      )}
    </div>
  );
}

export function DailyImportsCard({ initial }: { initial: Record<CardArticleSource, Setting> }) {
  return (
    <Card content="input">
      <CardHeader className="pt-5">
        <CardTitle icon={<Calendar />}>Daily import</CardTitle>
        <CardDescription>
          Each night, random pages with an image and no card wait in Curation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
        {CARD_ARTICLE_SOURCES.map((source) => (
          <SourceRow key={source} source={source} initial={initial[source]} />
        ))}
      </CardContent>
    </Card>
  );
}
