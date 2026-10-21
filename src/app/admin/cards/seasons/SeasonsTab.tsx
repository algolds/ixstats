"use client";
/** Seasons: the card season new imports take, and where nation edition control will live. */
import { useEffect, useState } from "react";
import { Calendar, TriangleFlag } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { MAX_CARD_SEASON } from "~/lib/cards/season";

const RANGE_HINT = `Enter a whole number from 1 to ${MAX_CARD_SEASON}.`;

/** The season the field holds, or null while it is not a whole number in range. */
function parseSeason(value: string): number | null {
  const season = Number(value);
  return value.trim() !== "" && Number.isInteger(season) && season >= 1 && season <= MAX_CARD_SEASON
    ? season
    : null;
}

export function SeasonsTab() {
  const notify = useNotify();
  const utils = api.useUtils();
  const current = api.cards.admin.seasons.get.useQuery();
  const [season, setSeason] = useState("");
  useEffect(() => {
    if (current.data !== undefined) setSeason(String(current.data));
  }, [current.data]);
  const parsed = parseSeason(season);
  const invalid = season !== "" && parsed === null;
  const save = api.cards.admin.seasons.set.useMutation({
    onSuccess: () => {
      notify.success("Card season saved");
      void utils.cards.admin.seasons.get.invalidate();
    },
    onError: (error) => notify.error("Season not saved", error.message),
  });

  return (
    <div className="space-y-6">
      <Card content="input">
        <CardHeader className="pt-5">
          <CardTitle icon={<Calendar />}>Card season</CardTitle>
          <CardDescription>
            New Lore and trophy cards take this season. NationStates cards keep their NS season, and
            existing cards keep theirs.
          </CardDescription>
        </CardHeader>
        {current.isError && (
          <p role="alert" className="text-destructive text-footnote px-6 pb-3">
            The card season did not load. Reload the page to try again.
          </p>
        )}
        <CardContent className="flex flex-wrap items-end gap-3 pb-5">
          <div className="space-y-1">
            <Label htmlFor="card-season">Card season</Label>
            <Input
              id="card-season"
              type="number"
              min={1}
              max={MAX_CARD_SEASON}
              aria-invalid={invalid}
              aria-describedby={invalid ? "card-season-hint" : undefined}
              value={season}
              onChange={(event) => setSeason(event.target.value)}
              className="w-28 tabular-nums"
            />
          </div>
          <Button
            disabled={save.isPending || parsed === null || parsed === current.data}
            onClick={() => parsed !== null && save.mutate({ season: parsed })}
          >
            Save season
          </Button>
          {invalid && (
            <p id="card-season-hint" className="text-destructive text-footnote basis-full">
              {RANGE_HINT}
            </p>
          )}
        </CardContent>
      </Card>
      <Card padding="lg">
        <EmptyState
          compact
          icon={<TriangleFlag />}
          title="Nation editions start with site seasons"
          message="Every claimed nation gets a card edition each site season. Who has this season's edition, minting a missing one and skipping a nation arrive here with them."
        />
      </Card>
    </div>
  );
}
