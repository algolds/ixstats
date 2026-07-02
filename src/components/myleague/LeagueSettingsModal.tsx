"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Settings, Upload, Loader2, Trash2, ImageIcon, Download, RefreshCw } from "lucide-react";

const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface LeagueSettingsModalProps {
  league: {
    id: string;
    name: string;
    logo?: string | null;
    coverImage?: string | null;
    status?: string;
    tier?: number;
    promotionCount?: number;
    relegationCount?: number;
    sportPreset?: string;
    archetype?: string;
    settings?: any;
    wikiSlug?: string | null;
    seasons?: Array<{
      id: string;
      seasonNumber: number;
      status: string;
    }>;
    teams?: Array<{
      id: string;
      name: string;
      color: string;
      logo?: string | null;
    }>;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  onOpenRoster?: (teamId: string) => void;
  onEditTeam?: (teamId: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export function LeagueSettingsModal({
  league,
  open,
  onOpenChange,
  onSaved,
  onOpenRoster,
  onEditTeam,
}: LeagueSettingsModalProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(league.name);
  const [logoUrl, setLogoUrl] = useState(league.logo ?? "");
  const [coverUrl, setCoverUrl] = useState(league.coverImage ?? "");
  const [wikiSlug, setWikiSlug] = useState(league.wikiSlug ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [mediaSearchFor, setMediaSearchFor] = useState<"logo" | "cover" | null>(null);

  // New settings states
  const [status, setStatus] = useState(league.status ?? "active");
  const [tier, setTier] = useState(league.tier ?? 1);
  const [promotionCount, setPromotionCount] = useState(league.promotionCount ?? 3);
  const [relegationCount, setRelegationCount] = useState(league.relegationCount ?? 3);

  // Archetype specific settings
  const initialSettings = (league.settings as Record<string, any>) || {};
  const [divisions, setDivisions] = useState<number>(initialSettings.divisions ?? 2);
  const [raceCount, setRaceCount] = useState<number>(initialSettings.raceCount ?? 20);
  const [weightClassesRaw, setWeightClassesRaw] = useState<string>(
    Array.isArray(initialSettings.weightClasses) ? initialSettings.weightClasses.join(", ") : ""
  );

  // Advanced settings custom rules
  const [gamesPerSeason, setGamesPerSeason] = useState<number>(
    initialSettings.gamesPerSeason ?? 14
  );
  const [doubleRoundRobin, setDoubleRoundRobin] = useState<boolean>(
    initialSettings.doubleRoundRobin ?? true
  );
  const [playoffFormat, setPlayoffFormat] = useState<string>(
    initialSettings.playoffFormat ?? "none"
  );
  const [seed, setSeed] = useState<string>(initialSettings.seed ?? "");

  // Advanced forms states
  const [overrideMatchId, setOverrideMatchId] = useState("");
  const [overrideHomeScore, setOverrideHomeScore] = useState(0);
  const [overrideAwayScore, setOverrideAwayScore] = useState(0);
  const [transferTeamId, setTransferTeamId] = useState("");
  const [transferTargetLeagueId, setTransferTargetLeagueId] = useState("");
  const [forceEditTeamId, setForceEditTeamId] = useState("");

  const isDivisionConference = league.archetype === "division_conference";
  const isCircuit = league.archetype === "circuit";
  const isBoxing = league.sportPreset === "boxing";

  const activeSeason = league.seasons?.find((s) => s.status === "in_progress");

  // Fetch list of leagues for transferring teams
  // ponytail: input `{}` (not `undefined`) so this shares the cache key used by
  // the MyLeague page and admin views — identical data, one fetch instead of two.
  const { data: otherLeagues } = api.sports.getLeagues.useQuery(
    {},
    {
      enabled: open,
    }
  );

  // Fetch schedule of matches for manual results override
  const { data: scheduleData } = api.sports.getSchedule.useQuery(
    { seasonId: activeSeason?.id ?? "" },
    { enabled: open && !!activeSeason?.id }
  );

  const activeMatches = (scheduleData?.type === "fixture" ? scheduleData.matches : []) ?? [];

  useEffect(() => {
    if (open) {
      setName(league.name);
      setLogoUrl(league.logo ?? "");
      setCoverUrl(league.coverImage ?? "");
      setWikiSlug(league.wikiSlug ?? "");
      setUploadedFile(null);
      setStatus(league.status ?? "active");
      setTier(league.tier ?? 1);
      setPromotionCount(league.promotionCount ?? 3);
      setRelegationCount(league.relegationCount ?? 3);

      const currentSettings = (league.settings as Record<string, any>) || {};
      setDivisions(currentSettings.divisions ?? 2);
      setRaceCount(currentSettings.raceCount ?? 20);
      setWeightClassesRaw(
        Array.isArray(currentSettings.weightClasses) ? currentSettings.weightClasses.join(", ") : ""
      );

      setGamesPerSeason(currentSettings.gamesPerSeason ?? 14);
      setDoubleRoundRobin(currentSettings.doubleRoundRobin ?? true);
      setPlayoffFormat(currentSettings.playoffFormat ?? "none");
      setSeed(currentSettings.seed ?? "");

      setOverrideMatchId("");
      setOverrideHomeScore(0);
      setOverrideAwayScore(0);
      setTransferTeamId("");
      setTransferTargetLeagueId("");
      setForceEditTeamId("");
    }
  }, [open, league]);

  const updateLeague = api.sports.updateLeague.useMutation({
    onSuccess: () => {
      notify.success("Settings Saved", "League settings updated.");
      utils.sports.getLeague.invalidate({ id: league.id });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => {
      notify.error("Save Failed", err.message);
    },
  });

  // Advanced Operations Mutations
  const resetSeason = api.sports.resetSeason.useMutation({
    onSuccess: () => {
      notify.success("Season Reset", "The active season progress has been reset.");
      utils.sports.getLeague.invalidate({ id: league.id });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => {
      notify.error("Reset Failed", err.message);
    },
  });

  const overrideMatchResult = api.sports.overrideMatchResult.useMutation({
    onSuccess: () => {
      notify.success("Override Successful", "Match result has been updated.");
      utils.sports.getLeague.invalidate({ id: league.id });
      if (activeSeason?.id) {
        utils.sports.getSchedule.invalidate({ seasonId: activeSeason.id });
        utils.sports.getStandings.invalidate({ seasonId: activeSeason.id });
      }
      onSaved?.();
      setOverrideMatchId("");
    },
    onError: (err) => {
      notify.error("Override Failed", err.message);
    },
  });

  const transferTeam = api.sports.transferTeam.useMutation({
    onSuccess: () => {
      notify.success("Transfer Successful", "Team has been moved to the target league.");
      utils.sports.getLeague.invalidate({ id: league.id });
      if (transferTargetLeagueId) {
        utils.sports.getLeague.invalidate({ id: transferTargetLeagueId });
      }
      onSaved?.();
      setTransferTeamId("");
    },
    onError: (err) => {
      notify.error("Transfer Failed", err.message);
    },
  });

  const regenerateSchedule = api.sports.regenerateSchedule.useMutation({
    onSuccess: () => {
      notify.success("Schedule Regenerated", "A fresh match schedule has been generated.");
      utils.sports.getLeague.invalidate({ id: league.id });
      if (activeSeason?.id) {
        utils.sports.getSchedule.invalidate({ seasonId: activeSeason.id });
      }
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => {
      notify.error("Regeneration Failed", err.message);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      notify.error("Invalid File", "Please select a PNG, JPEG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      notify.error("File Too Large", "Image must be under 5 MB.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(withBasePath("/api/upload/image"), {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      const result = (await response.json()) as { url: string };
      setLogoUrl(result.url);
      setUploadedFile(file);
    } catch (err) {
      notify.error("Upload Failed", err instanceof Error ? err.message : "Could not upload image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    setUploadedFile(null);
  };

  const handleSave = () => {
    if (!name.trim()) {
      notify.error("Name Required", "League name cannot be empty.");
      return;
    }

    const updatedSettings: Record<string, any> = {
      ...((league.settings as Record<string, any>) || {}),
    };
    if (isDivisionConference) {
      updatedSettings.divisions = divisions;
    }
    if (isBoxing) {
      updatedSettings.weightClasses = weightClassesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (isCircuit) {
      updatedSettings.raceCount = raceCount;
    }

    updatedSettings.gamesPerSeason = gamesPerSeason;
    updatedSettings.doubleRoundRobin = doubleRoundRobin;
    updatedSettings.playoffFormat = playoffFormat;
    updatedSettings.seed = seed ? Number(seed) : null;

    updateLeague.mutate({
      id: league.id,
      name: name.trim(),
      logo: logoUrl || null,
      coverImage: coverUrl || null,
      status,
      tier,
      promotionCount,
      relegationCount,
      settings: updatedSettings,
      wikiSlug: wikiSlug.trim() || null,
    });
  };

  const previewSrc = uploadedFile ? URL.createObjectURL(uploadedFile) : logoUrl || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            League Settings
          </DialogTitle>
          <DialogDescription>
            Edit name, branding, and competition rules for this league.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="branding" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="competition">Competition</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="league-name">League Name</Label>
              <Input
                id="league-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter league name..."
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wiki-slug">Wiki Article Slug</Label>
              <Input
                id="wiki-slug"
                value={wikiSlug}
                onChange={(e) => setWikiSlug(e.target.value)}
                placeholder="e.g. Liga_Ixnay"
                maxLength={100}
              />
              <p className="text-muted-foreground text-[10px]">
                Links this league to its IxWiki article.
              </p>
            </div>

            <div className="space-y-2">
              <Label>League Logo</Label>
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed",
                    previewSrc ? "border-border bg-muted/50" : "border-border/50 bg-muted/30"
                  )}
                >
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground text-[10px] font-medium">No logo</span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-xs"
                  >
                    {isUploading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {isUploading ? "Uploading..." : "Upload Image"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMediaSearchFor("logo")}
                    className="text-xs"
                  >
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                    Browse Media
                  </Button>
                  {previewSrc && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="text-destructive hover:text-destructive text-xs"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                  <p className="text-muted-foreground text-[10px] leading-tight">
                    PNG, JPEG, GIF, or WebP. Max 5 MB.
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <p className="text-muted-foreground text-[10px] leading-tight">
                Shown on the card carousel. Recommended 3:2 ratio.
              </p>
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed",
                    coverUrl ? "border-border bg-muted/50" : "border-border/50 bg-muted/30"
                  )}
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground text-[10px] font-medium">No cover</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMediaSearchFor("cover")}
                    className="text-xs"
                  >
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                    Browse Media
                  </Button>
                  {coverUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCoverUrl("")}
                      className="text-destructive hover:text-destructive text-xs"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="competition" className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="league-status">League Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="league-status" className="h-9 text-xs">
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="league-tier">League Tier</Label>
                <Input
                  id="league-tier"
                  type="number"
                  min={1}
                  value={tier}
                  onChange={(e) => setTier(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promotion-count">Promotion Count</Label>
                <Input
                  id="promotion-count"
                  type="number"
                  min={0}
                  value={promotionCount}
                  onChange={(e) => setPromotionCount(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relegation-count">Relegation Count</Label>
                <Input
                  id="relegation-count"
                  type="number"
                  min={0}
                  value={relegationCount}
                  onChange={(e) => setRelegationCount(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Archetype / Preset Specific Settings */}
            {isDivisionConference && (
              <div className="border-border/30 space-y-2 border-t pt-3">
                <Label htmlFor="divisions-count">Divisions Count</Label>
                <Input
                  id="divisions-count"
                  type="number"
                  min={1}
                  value={divisions}
                  onChange={(e) => setDivisions(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 text-xs"
                />
                <p className="text-muted-foreground text-[10px]">
                  Configures the number of divisions within the league's conference.
                </p>
              </div>
            )}

            {isCircuit && (
              <div className="border-border/30 space-y-2 border-t pt-3">
                <Label htmlFor="race-count">Race Count</Label>
                <Input
                  id="race-count"
                  type="number"
                  min={1}
                  value={raceCount}
                  onChange={(e) => setRaceCount(Math.max(1, Number(e.target.value) || 1))}
                  className="h-9 text-xs"
                />
                <p className="text-muted-foreground text-[10px]">
                  Configures the number of races run in a season.
                </p>
              </div>
            )}

            {isBoxing && (
              <div className="border-border/30 space-y-2 border-t pt-3">
                <Label htmlFor="weight-classes">Weight Classes (Comma Separated)</Label>
                <Input
                  id="weight-classes"
                  value={weightClassesRaw}
                  onChange={(e) => setWeightClassesRaw(e.target.value)}
                  placeholder="Heavyweight, Middleweight, Welterweight..."
                  className="h-9 text-xs"
                />
                <p className="text-muted-foreground text-[10px]">
                  Comma-separated list of weight divisions.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="py-3">
            <div className="thin-scrollbar max-h-[350px] space-y-5 overflow-y-auto pr-2">
              {/* 1. Roster Editor */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Force-Edit Team
                </Label>
                <div className="flex gap-2">
                  <Select value={forceEditTeamId} onValueChange={setForceEditTeamId}>
                    <SelectTrigger className="h-9 flex-1 text-xs">
                      <SelectValue placeholder="Select team to edit..." />
                    </SelectTrigger>
                    <SelectContent>
                      {league.teams?.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!forceEditTeamId}
                    onClick={() => {
                      if (forceEditTeamId && onEditTeam) {
                        onEditTeam(forceEditTeamId);
                        onOpenChange(false);
                      }
                    }}
                    className="text-xs"
                  >
                    Rename / Brand
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!forceEditTeamId}
                    onClick={() => {
                      if (forceEditTeamId && onOpenRoster) {
                        onOpenRoster(forceEditTeamId);
                        onOpenChange(false);
                      }
                    }}
                    className="text-xs"
                  >
                    Roster
                  </Button>
                </div>
                <p className="text-muted-foreground text-[10px]">
                  As league creator you can rename, recolor, and rebrand any team here.
                </p>
              </div>

              {/* 2. Active Season Actions */}
              {activeSeason && (
                <div className="border-border/10 space-y-3 border-t pt-4">
                  <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Season Operations (Season {activeSeason.seasonNumber})
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={resetSeason.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            "WARNING: This will permanently delete all matches, standings, brackets, and races for the current season. Roster data is preserved. Are you sure?"
                          )
                        ) {
                          resetSeason.mutate({ seasonId: activeSeason.id });
                        }
                      }}
                      className="text-xs"
                    >
                      {resetSeason.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Reset Current Season
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={regenerateSchedule.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            "This will delete all matches and regenerate a fresh schedule of matches. This can only be done if no matches have been played yet. Proceed?"
                          )
                        ) {
                          regenerateSchedule.mutate({ seasonId: activeSeason.id });
                        }
                      }}
                      className="border-amber-500/20 text-xs text-amber-500 hover:bg-amber-500/5"
                    >
                      {regenerateSchedule.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Regenerate Matches
                    </Button>
                  </div>
                </div>
              )}

              {/* 3. Custom Simulation Rules */}
              <div className="border-border/10 space-y-3 border-t pt-4">
                <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Custom Engine Rules
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="games-per-season" className="text-[11px]">
                      Games Per Season
                    </Label>
                    <Input
                      id="games-per-season"
                      type="number"
                      min={1}
                      value={gamesPerSeason}
                      onChange={(e) => setGamesPerSeason(Math.max(1, Number(e.target.value) || 14))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="double-rr" className="text-[11px]">
                      Double Round Robin
                    </Label>
                    <Select
                      value={doubleRoundRobin ? "true" : "false"}
                      onValueChange={(val) => setDoubleRoundRobin(val === "true")}
                    >
                      <SelectTrigger id="double-rr" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No (Single RR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="playoff-format" className="text-[11px]">
                      Playoff Format
                    </Label>
                    <Select value={playoffFormat} onValueChange={setPlayoffFormat}>
                      <SelectTrigger id="playoff-format" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Playoffs (Table Winner)</SelectItem>
                        <SelectItem value="finals">Top 2 (Finals Only)</SelectItem>
                        <SelectItem value="semi_finals">Top 4 (Semifinals & Finals)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rng-seed" className="text-[11px]">
                      RNG Seed Override
                    </Label>
                    <Input
                      id="rng-seed"
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      placeholder="Automatic RNG seed..."
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Manual Result Override */}
              {activeSeason && activeMatches.length > 0 && (
                <div className="border-border/10 space-y-3 border-t pt-4">
                  <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    Manual Result Override
                  </Label>
                  <div className="space-y-2">
                    <Select value={overrideMatchId} onValueChange={setOverrideMatchId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select match to override..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeMatches.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>
                            Md {m.matchDay}: {m.homeTeam.name} {m.homeScore ?? "?"} -{" "}
                            {m.awayScore ?? "?"} {m.awayTeam.name} ({m.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {overrideMatchId && (
                      <div className="bg-muted/30 border-border/10 space-y-3 rounded-lg border p-3">
                        <div className="flex items-center justify-around gap-2">
                          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                            <span className="text-muted-foreground w-full truncate text-center text-[10px] font-bold">
                              {
                                activeMatches.find((m: any) => m.id === overrideMatchId)?.homeTeam
                                  .name
                              }
                            </span>
                            <Input
                              type="number"
                              min={0}
                              value={overrideHomeScore}
                              onChange={(e) =>
                                setOverrideHomeScore(Math.max(0, Number(e.target.value) || 0))
                              }
                              className="h-9 w-16 text-center text-sm font-bold"
                            />
                          </div>
                          <span className="text-muted-foreground/45 text-sm font-semibold">VS</span>
                          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                            <span className="text-muted-foreground w-full truncate text-center text-[10px] font-bold">
                              {
                                activeMatches.find((m: any) => m.id === overrideMatchId)?.awayTeam
                                  .name
                              }
                            </span>
                            <Input
                              type="number"
                              min={0}
                              value={overrideAwayScore}
                              onChange={(e) =>
                                setOverrideAwayScore(Math.max(0, Number(e.target.value) || 0))
                              }
                              className="h-9 w-16 text-center text-sm font-bold"
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          disabled={overrideMatchResult.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                "Are you sure you want to force set this score? Standings will be automatically recalculated."
                              )
                            ) {
                              overrideMatchResult.mutate({
                                matchId: overrideMatchId,
                                homeScore: overrideHomeScore,
                                awayScore: overrideAwayScore,
                              });
                            }
                          }}
                          className="w-full text-xs"
                        >
                          {overrideMatchResult.isPending && (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          )}
                          Save Overridden Score
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Transfer / Swap Teams */}
              <div className="border-border/10 space-y-3 border-t pt-4">
                <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Transfer Team to League
                </Label>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={transferTeamId} onValueChange={setTransferTeamId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {league.teams?.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={transferTargetLeagueId}
                      onValueChange={setTransferTargetLeagueId}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Target league..." />
                      </SelectTrigger>
                      <SelectContent>
                        {otherLeagues
                          ?.filter((l) => l.id !== league.id)
                          ?.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!transferTeamId || !transferTargetLeagueId || transferTeam.isPending}
                    onClick={() => {
                      const teamName = league.teams?.find((t) => t.id === transferTeamId)?.name;
                      const targetName = otherLeagues?.find(
                        (l) => l.id === transferTargetLeagueId
                      )?.name;
                      if (
                        confirm(
                          `Are you sure you want to move the team "${teamName}" to "${targetName}"?`
                        )
                      ) {
                        transferTeam.mutate({
                          teamId: transferTeamId,
                          targetLeagueId: transferTargetLeagueId,
                        });
                      }
                    }}
                    className="w-full border-amber-400/20 text-xs text-amber-400 hover:bg-amber-400/5"
                  >
                    {transferTeam.isPending && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    Move Team
                  </Button>
                </div>
              </div>

              {/* 6. Export League Data */}
              <div className="border-border/10 space-y-2 border-t pt-4">
                <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Backup & Data Portability
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const exportData = await utils.sports.exportLeagueData.fetch({
                        leagueId: league.id,
                      });
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${league.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_data.json`;
                      a.click();
                      notify.success("Export Successful", "League database records downloaded.");
                    } catch (err) {
                      notify.error("Export Failed", "Could not retrieve league records.");
                    }
                  }}
                  className="w-full gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export League Database JSON
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {mediaSearchFor && (
          <MediaSearchModal
            isOpen={!!mediaSearchFor}
            onClose={() => setMediaSearchFor(null)}
            onImageSelect={(url) => {
              if (mediaSearchFor === "logo") {
                setLogoUrl(url);
                setUploadedFile(null);
              } else {
                setCoverUrl(url);
              }
              setMediaSearchFor(null);
            }}
          />
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateLeague.isPending} className="text-xs">
            {updateLeague.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
