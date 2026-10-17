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

export function SeasonsTab() {
  const notify = useNotify();
  const utils = api.useUtils();
  const current = api.cards.admin.seasons.get.useQuery();
  const [season, setSeason] = useState("");
  useEffect(() => {
    if (current.data !== undefined) setSeason(String(current.data));
  }, [current.data]);
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
            Cards imported from now on take this season. Existing cards keep theirs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3 pb-5">
          <div className="space-y-1">
            <Label htmlFor="card-season">Card season</Label>
            <Input
              id="card-season"
              type="number"
              min={1}
              max={100}
              value={season}
              onChange={(event) => setSeason(event.target.value)}
              className="w-28 tabular-nums"
            />
          </div>
          <Button
            disabled={save.isPending || season === ""}
            onClick={() => save.mutate({ season: Number(season) })}
          >
            Save season
          </Button>
        </CardContent>
      </Card>
      <Card padding="lg">
        <EmptyState
          icon={<TriangleFlag />}
          title="Nation editions start with site seasons"
          message="Every claimed nation gets a card edition each site season. Who has this season's edition, minting a missing one and skipping a nation arrive here with them."
        />
      </Card>
    </div>
  );
}
