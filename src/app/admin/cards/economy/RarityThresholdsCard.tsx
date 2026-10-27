"use client";
/** Each source wiki's rarity table: the minimum quality score for each rarity (below Uncommon is Common). */
import { useState } from "react";
import { StatsUpSquare } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CARD_WIKI_SOURCES, cardSourceLabel, type CardWikiSource } from "~/lib/cards/card-sources";
import {
  MAX_QUALITY_SCORE,
  RarityThresholdsSchema,
  TIERED_RARITIES,
  type RarityThresholds,
  type TieredRarity,
} from "~/lib/cards/rarity-engine";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { RARITY_LABELS } from "../shared/card-labels";
import { fieldNumber } from "./NumberConfigCard";

/** Five columns at every width, so the one header row lines up with every wiki's inputs. */
const RARITY_GRID = "grid grid-cols-5 gap-2";

function SourceTable({ source, initial }: { source: CardWikiSource; initial: RarityThresholds }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [draft, setDraft] = useState<Partial<Record<TieredRarity, string>>>({});
  const save = api.cards.admin.economy.saveRarityThresholds.useMutation({
    onSuccess: () => {
      notify.success(`${cardSourceLabel(source)} rarity table saved`);
      void utils.cards.admin.economy.get.invalidate();
    },
    onError: (error) => notify.error("Rarity table not saved", error.message),
  });
  const raw = (rarity: TieredRarity) => draft[rarity] ?? String(initial[rarity]);
  const table: RarityThresholds = { ...initial };
  for (const rarity of TIERED_RARITIES) table[rarity] = fieldNumber(raw(rarity));
  const check = RarityThresholdsSchema.safeParse(table);
  const changed = TIERED_RARITIES.some((rarity) => table[rarity] !== initial[rarity]);
  const label = cardSourceLabel(source);
  const problemId = `rarity-${source}-problem`;

  return (
    <div className="space-y-2">
      <p className="text-subhead text-label">{label}</p>
      <div className={RARITY_GRID}>
        {TIERED_RARITIES.map((rarity) => (
          <Input
            key={rarity}
            aria-label={`${label} ${RARITY_LABELS[rarity]}`}
            aria-invalid={!check.success}
            aria-describedby={check.success ? undefined : problemId}
            type="number"
            min={0}
            max={MAX_QUALITY_SCORE}
            step="any"
            value={raw(rarity)}
            onChange={(event) =>
              setDraft((current) => ({ ...current, [rarity]: event.target.value }))
            }
            className="tabular-nums"
          />
        ))}
      </div>
      {!check.success && (
        <p id={problemId} className="text-destructive text-footnote">
          {check.error.issues[0]?.message}
        </p>
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={!check.success || !changed || save.isPending}
        onClick={() => save.mutate({ source, thresholds: table })}
      >
        Save {label}
      </Button>
    </div>
  );
}

export function RarityThresholdsCard({
  initial,
}: {
  initial: Record<CardWikiSource, RarityThresholds>;
}) {
  return (
    <Card content="input">
      <CardHeader className="pt-5">
        <CardTitle icon={<StatsUpSquare />}>Rarity tables</CardTitle>
        <CardDescription>
          The lowest quality score, 0 to 100, for each rarity; a lower score is Common. New imports
          use these; existing cards keep their rarity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pb-5">
        {/* The inputs carry their own names; this row shows the columns to sighted admins. */}
        <div aria-hidden="true" className={`${RARITY_GRID} text-footnote text-label-secondary`}>
          {TIERED_RARITIES.map((rarity) => (
            <span key={rarity} className="break-words hyphens-auto">
              {RARITY_LABELS[rarity]}
            </span>
          ))}
        </div>
        {CARD_WIKI_SOURCES.map((source) => (
          <SourceTable key={source} source={source} initial={initial[source]} />
        ))}
      </CardContent>
    </Card>
  );
}
