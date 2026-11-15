"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { WikiSourcePicker, useWikiSource } from "~/components/wiki-os/shared/WikiSourcePicker";
import { toWikiSlug, type WikiLeagueTeam } from "~/lib/sports/league-wiki";
import type { WikiSource } from "~/lib/wiki-os/config";
import { wikiReadErrorText, wikiSourceLabel } from "~/lib/wiki-os/wiki-source-availability";

interface LeagueWikiImportProps {
  wikiSlug: string;
  onWikiSlugChange: (wikiSlug: string) => void;
  /** How many teams are imported now (null when none). */
  importedCount: number | null;
  minTeams: number;
  maxTeams: number;
  onImport: (
    teams: WikiLeagueTeam[],
    leagueWiki?: { wikiSlug: string; wikiSource: WikiSource }
  ) => void;
  onClear: () => void;
}

const teamKey = (team: WikiLeagueTeam) => team.wikiSlug ?? team.name;

/**
 * The creator's wiki step: the league's wiki article, and a checklist of the teams an article names. Teams imported
 * from a sister wiki keep both their article slug and `wikiSource` so their links open the right wiki.
 */
export function LeagueWikiImport({
  wikiSlug,
  onWikiSlugChange,
  importedCount,
  minTeams,
  maxTeams,
  onImport,
  onClear,
}: LeagueWikiImportProps) {
  const [requested, setRequested] = useState<{ wikiSlug: string; wiki: WikiSource } | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  /** The page read on a sister wiki; the league's own article is always an IxWiki page. */
  const [sisterTitle, setSisterTitle] = useState("");
  const { source, setSource, options } = useWikiSource("imports");
  const importSlug = toWikiSlug(source === "ixwiki" ? wikiSlug : sisterTitle);

  const preview = api.sports.previewWikiTeams.useQuery(
    requested ?? { wikiSlug: "", wiki: source },
    {
      enabled: requested !== null,
      retry: false,
    }
  );
  const found = preview.data ?? [];
  const chosen = found.filter((team) => !skipped.includes(teamKey(team)));
  const chosenFits = chosen.length >= minTeams && chosen.length <= maxTeams;

  const handleSlugChange = (value: string) => {
    setRequested(null);
    onWikiSlugChange(value);
  };

  const handleToggle = (team: WikiLeagueTeam, checked: boolean) => {
    const key = teamKey(team);
    setSkipped((prev) => (checked ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleAccept = () => {
    const importedFrom = requested ?? (importSlug ? { wikiSlug: importSlug, wiki: source } : null);
    onImport(
      chosen,
      importedFrom ? { wikiSlug: importedFrom.wikiSlug, wikiSource: importedFrom.wiki } : undefined
    );
    setRequested(null);
    setSkipped([]);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="league-wiki-slug">Wiki article</Label>
      <Input
        id="league-wiki-slug"
        placeholder="Article title, for example Varro_League"
        value={wikiSlug}
        onChange={(e) => handleSlugChange(e.target.value.slice(0, 500))}
      />
      <p className="text-label-secondary text-footnote">
        Optional. Links the league to its wiki article, and can fill in the team names from it.
      </p>

      <p className="text-label text-footnote pt-1 font-medium">Import team names from</p>
      <WikiSourcePicker
        size="sm"
        value={source}
        options={options}
        onValueChange={(next) => {
          setRequested(null);
          setSource(next);
        }}
      />
      <div className="flex gap-2">
        {source !== "ixwiki" && (
          <Input
            aria-label={`${wikiSourceLabel(source)} article`}
            placeholder={`Article title on ${wikiSourceLabel(source)}`}
            value={sisterTitle}
            onChange={(e) => {
              setRequested(null);
              setSisterTitle(e.target.value.slice(0, 500));
            }}
          />
        )}
        <Button
          type="button"
          variant="outline"
          disabled={!importSlug || preview.isFetching}
          onClick={() => {
            setSkipped([]);
            if (importSlug) setRequested({ wikiSlug: importSlug, wiki: source });
          }}
        >
          {preview.isFetching ? "Reading..." : "Import teams"}
        </Button>
      </div>

      {importedCount !== null && (
        <div className="border-separator bg-fill-3 rounded-control flex items-center justify-between gap-3 border px-3 py-2">
          <p className="text-label text-footnote">{importedCount} teams imported from the wiki.</p>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Use placeholder names
          </Button>
        </div>
      )}

      {requested !== null && preview.isError && (
        <p className="text-destructive text-footnote" role="alert">
          {wikiReadErrorText(preview.error, "That article could not be read. Try again.")}
        </p>
      )}

      {requested !== null && preview.isSuccess && found.length === 0 && (
        <p className="text-label-secondary text-footnote">
          No teams found in that article. Check the title, or name the teams later.
        </p>
      )}

      {requested !== null && found.length > 0 && (
        <div className="border-separator bg-fill-4 rounded-control space-y-3 border p-3">
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {found.map((team) => (
              <li key={teamKey(team)}>
                <label className="text-label text-footnote flex items-center gap-2">
                  <Checkbox
                    checked={!skipped.includes(teamKey(team))}
                    onCheckedChange={(checked) => handleToggle(team, checked === true)}
                  />
                  {team.name}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <p className="text-label-secondary text-footnote">
              {chosenFits
                ? `${chosen.length} selected.`
                : `Select between ${minTeams} and ${maxTeams} teams.`}
            </p>
            <Button type="button" size="sm" disabled={!chosenFits} onClick={handleAccept}>
              Use {chosen.length} teams
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
