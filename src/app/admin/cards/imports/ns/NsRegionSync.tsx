"use client";
/** Start a NationStates region sync: regions and seasons, with a finder for the largest tagged regions. */
import { useState } from "react";
import { Globe, Search } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { parseSeasonList } from "./season-list";

/** The most regions one start takes, as the server does. */
const MAX_REGIONS = 20;

const regionList = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean);

/** The largest regions with a tag, each one click from the region list. */
function RegionFinder({ onAdd }: { onAdd: (name: string) => void }) {
  const notify = useNotify();
  const [tag, setTag] = useState("gargantuan");
  const discover = api.cards.admin.nationstates.discoverRegions.useMutation({
    onError: (error) => notify.error("Could not reach NationStates", error.message),
  });
  const found = discover.data ?? [];

  return (
    <div className="border-separator space-y-2 border-t pt-4">
      <Label htmlFor="ns-tag">Find large regions by tag</Label>
      <div className="flex gap-2">
        <Input id="ns-tag" value={tag} onChange={(event) => setTag(event.target.value)} />
        <Button
          variant="secondary"
          disabled={!tag.trim() || discover.isPending}
          onClick={() => discover.mutate({ tag: tag.trim(), limit: 15 })}
        >
          <Search className="size-4" />
          Find
        </Button>
      </div>
      {discover.isSuccess && found.length === 0 && (
        <p className="text-footnote text-label-secondary">No region has that tag.</p>
      )}
      {found.length > 0 && (
        <ul className="space-y-1">
          {found.map((region) => (
            <li key={region.id} className="flex items-center justify-between gap-2">
              <span className="text-callout">
                {region.name} ·{" "}
                <span className="text-label-secondary tabular-nums">
                  {region.numnations.toLocaleString()} nations
                </span>
              </span>
              <Button
                size="xs"
                variant="ghost"
                aria-label={`Add ${region.name}`}
                onClick={() => onAdd(region.name)}
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NsRegionSync({ onStarted }: { onStarted: () => void }) {
  const notify = useNotify();
  const [regions, setRegions] = useState("");
  const [seasons, setSeasons] = useState("1-13");
  const start = api.cards.admin.nationstates.start.useMutation({
    onSuccess: (started) => {
      notify.success(
        "Sync started",
        `${started.length} ${started.length === 1 ? "region" : "regions"} syncing in the background.`
      );
      setRegions("");
      onStarted();
    },
    onError: (error) => notify.error("Sync not started", error.message),
  });

  const names = regionList(regions);
  const seasonList = parseSeasonList(seasons);
  const add = (name: string) =>
    setRegions((current) => (current.trim() ? `${current.trim()}\n${name}` : name));

  return (
    <Card content="input">
      <CardHeader className="pt-5">
        <CardTitle icon={<Globe />}>Sync a region</CardTitle>
        <CardDescription>
          Reads the official card dumps. New cards wait in Curation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <div className="space-y-1">
          <Label htmlFor="ns-regions">Regions, one per line</Label>
          <Textarea
            id="ns-regions"
            rows={3}
            value={regions}
            onChange={(event) => setRegions(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ns-seasons">Seasons</Label>
          <Input
            id="ns-seasons"
            aria-describedby="ns-seasons-reading"
            value={seasons}
            onChange={(event) => setSeasons(event.target.value)}
          />
          <p id="ns-seasons-reading" className="text-footnote text-label-secondary">
            {seasonList.length > 0 ? `Seasons ${seasonList.join(", ")}` : "Every season"}
          </p>
        </div>
        {names.length > MAX_REGIONS && (
          <p className="text-footnote text-destructive">
            At most {MAX_REGIONS} regions at a time. Start the rest after these.
          </p>
        )}
        <Button
          disabled={names.length === 0 || names.length > MAX_REGIONS || start.isPending}
          onClick={() => start.mutate({ regions: names, seasons: seasonList })}
        >
          Start sync
        </Button>
        <RegionFinder onAdd={add} />
      </CardContent>
    </Card>
  );
}
