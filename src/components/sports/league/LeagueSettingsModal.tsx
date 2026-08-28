"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Settings, SystemRestart as Loader2 } from "iconoir-react";

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { LeagueBrandingTab } from "./settings/LeagueBrandingTab";
import { LeagueCompetitionTab } from "./settings/LeagueCompetitionTab";
import { LeagueAdvancedTab } from "./settings/LeagueAdvancedTab";

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
      matches?: any[];
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

  const isDivisionConference = league.archetype === "division_conference";
  const isCircuit = league.archetype === "circuit";
  const isBoxing = league.sportPreset === "boxing";

  const activeSeason = league.seasons?.find((s) => s.status === "in_progress") ?? null;

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
    }
  }, [open, league]);

  const updateLeague = api.sports.updateLeague.useMutation({
    onSuccess: () => {
      notify.success("Settings Saved", "League settings updated.");
      void utils.sports.getLeague.invalidate({ id: league.id });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => {
      notify.error("Save Failed", err.message);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      notify.error("Invalid file type", "Please upload a PNG, JPEG, GIF, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      notify.error("File too large", "Image must be under 5 MB.");
      return;
    }

    setUploadedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setLogoUrl(objectUrl);
  };

  const handleRemoveLogo = () => {
    setUploadedFile(null);
    setLogoUrl("");
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      notify.error("Validation Error", "League name cannot be empty.");
      return;
    }

    let finalLogoUrl = logoUrl;

    if (uploadedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", uploadedFile);
        formData.append("type", "league-logo");

        const res = await fetch(withBasePath("/api/upload"), {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Upload failed");
        }

        const data = await res.json();
        finalLogoUrl = data.url;
      } catch (err) {
        setIsUploading(false);
        notify.error(
          "Upload Failed",
          err instanceof Error ? err.message : "Failed to upload logo."
        );
        return;
      }
      setIsUploading(false);
    }

    const weightClasses = isBoxing
      ? weightClassesRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const currentSettings = (league.settings as Record<string, any>) || {};
    const updatedSettings = {
      ...currentSettings,
      ...(isDivisionConference ? { divisions } : {}),
      ...(isCircuit ? { raceCount } : {}),
      ...(isBoxing && weightClasses ? { weightClasses } : {}),
      gamesPerSeason,
      doubleRoundRobin,
      playoffFormat,
      seed: seed.trim() || undefined,
    };

    updateLeague.mutate({
      id: league.id,
      name: trimmedName,
      logo: finalLogoUrl || null,
      coverImage: coverUrl || null,
      wikiSlug: wikiSlug.trim() || null,
      status: status as any,
      tier,
      promotionCount,
      relegationCount,
      settings: updatedSettings,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            League Settings & Engine
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manage branding, promotion structure, and simulator engine behavior.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="branding" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="competition">Competition</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="branding">
            <LeagueBrandingTab
              name={name}
              setName={setName}
              wikiSlug={wikiSlug}
              setWikiSlug={setWikiSlug}
              previewSrc={logoUrl}
              coverUrl={coverUrl}
              setCoverUrl={setCoverUrl}
              isUploading={isUploading}
              onFileSelect={handleFileSelect}
              onRemoveLogo={handleRemoveLogo}
              onOpenMediaSearch={(target) => setMediaSearchFor(target)}
            />
          </TabsContent>

          <TabsContent value="competition">
            <LeagueCompetitionTab
              status={status}
              setStatus={setStatus}
              tier={tier}
              setTier={setTier}
              promotionCount={promotionCount}
              setPromotionCount={setPromotionCount}
              relegationCount={relegationCount}
              setRelegationCount={setRelegationCount}
              isDivisionConference={isDivisionConference}
              divisions={divisions}
              setDivisions={setDivisions}
              isCircuit={isCircuit}
              raceCount={raceCount}
              setRaceCount={setRaceCount}
              isBoxing={isBoxing}
              weightClassesRaw={weightClassesRaw}
              setWeightClassesRaw={setWeightClassesRaw}
            />
          </TabsContent>

          <TabsContent value="advanced">
            <LeagueAdvancedTab
              league={league}
              activeSeason={activeSeason}
              gamesPerSeason={gamesPerSeason}
              setGamesPerSeason={setGamesPerSeason}
              doubleRoundRobin={doubleRoundRobin}
              setDoubleRoundRobin={setDoubleRoundRobin}
              playoffFormat={playoffFormat}
              setPlayoffFormat={setPlayoffFormat}
              seed={seed}
              setSeed={setSeed}
              onEditTeam={onEditTeam}
              onOpenRoster={onOpenRoster}
              onOpenChange={onOpenChange}
            />
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
          <Button
            onClick={handleSave}
            disabled={updateLeague.isPending || isUploading}
            className="text-xs"
          >
            {updateLeague.isPending || isUploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
