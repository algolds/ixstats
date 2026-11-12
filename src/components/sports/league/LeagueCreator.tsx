"use client";

import React, { useState, useMemo, useCallback, useReducer } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { SystemRestart as Loader2, ArrowLeft, ArrowRight, Check, Trophy } from "iconoir-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { usePaidMutateAsync } from "~/components/sports/core/usePaidActionRequestId";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { assetUrl } from "~/lib/base-path";
import { useLeagueCoverImage } from "~/hooks/useLeagueCoverImage";
import { springSmooth } from "~/lib/design/motion";
import type { ArchetypeType } from "~/lib/sports";
import { DEFAULT_MATCH_INTERVAL_DAYS } from "~/lib/sports/scheduler";
import { toWikiSlug } from "~/lib/sports/league-wiki";
import { INITIAL_LEAGUE_WIKI, leagueWikiReducer } from "~/lib/sports/league-wiki-state";
import {
  archetypeLabels,
  cardVariants,
  intervalLabel,
  stepVariants,
} from "./league-creator-config";
import { LeagueWikiImport } from "./LeagueWikiImport";
import { LeagueCoverField } from "./LeagueCoverField";
import { LeagueCreatedStep } from "./LeagueCreatedStep";

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

interface LeagueCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (leagueId: string) => void;
  isCanonical?: boolean;
}

export function LeagueCreator({
  open,
  onOpenChange,
  onCreated,
  isCanonical = false,
}: LeagueCreatorProps) {
  const notify = useNotify();

  const { data: presets, isLoading: presetsLoading } = api.sports.getSportPresets.useQuery(
    undefined,
    { enabled: open }
  );

  const createMutation = api.sports.createLeague.useMutation();
  const charter = usePaidMutateAsync(createMutation.mutateAsync); // one charge per press

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);
  const [createdLeagueId, setCreatedLeagueId] = useState<string | null>(null);

  // Form fields
  const [leagueName, setLeagueName] = useState("");
  const [teamCount, setTeamCount] = useState(20);
  const [divisions, setDivisions] = useState(2);
  const [weightClassesRaw, setWeightClassesRaw] = useState("");
  const [raceCount, setRaceCount] = useState(20);
  const [matchIntervalDays, setMatchIntervalDays] = useState(DEFAULT_MATCH_INTERVAL_DAYS);
  // The league's wiki article and the teams imported from it
  const [wiki, dispatchWiki] = useReducer(leagueWikiReducer, INITIAL_LEAGUE_WIKI);

  // Cover image: a Commons suggestion for the sport, shuffle, remove, or a picked file
  const {
    coverImage,
    setCoverImage,
    commonsData,
    commonsLoading,
    handleShuffleCover,
    handleRemoveCover,
    resetCover,
  } = useLeagueCoverImage({ open, selectedPresetKey, currentStep });
  const [mediaSearchOpen, setMediaSearchOpen] = useState(false);

  // Derived
  const selectedPreset = useMemo(() => {
    if (!presets || !selectedPresetKey) return null;
    return presets.find((p) => p.key === selectedPresetKey) ?? null;
  }, [presets, selectedPresetKey]);

  const archetype = selectedPreset?.archetype as ArchetypeType | undefined;
  const archetypeLabel = archetype ? archetypeLabels[archetype] : null;

  const isDivisionConference = archetype === "division_conference";
  const isCircuit = archetype === "circuit";
  // Boxing has bracket archetype
  const isBoxing = selectedPresetKey === "boxing";

  const canNextStep1 = !!selectedPresetKey;
  const canNextStep2 =
    leagueName.trim().length > 0 && teamCount >= (selectedPreset?.minTeamCount ?? 2);

  const handleSportSelect = useCallback(
    (key: string) => {
      setSelectedPresetKey(key);
      const preset = presets?.find((p) => p.key === key);
      if (preset) {
        setTeamCount(preset.defaultTeamCount);
        dispatchWiki({ type: "teamCountEdited", teamCount: preset.defaultTeamCount });
      }
    },
    [presets]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const resetForm = useCallback(() => {
    setCurrentStep(1);
    setSelectedPresetKey(null);
    setCreatedLeagueId(null);
    setLeagueName("");
    setTeamCount(20);
    setDivisions(2);
    setWeightClassesRaw("");
    setRaceCount(20);
    dispatchWiki({ type: "reset" });
    resetCover();
    setMediaSearchOpen(false);
  }, [resetCover]);

  const handleCreateAnother = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const handleViewLeague = useCallback(() => {
    if (createdLeagueId && onCreated) {
      onCreated(createdLeagueId);
    }
    handleClose();
  }, [createdLeagueId, onCreated, handleClose]);

  const handleCreate = useCallback(async () => {
    if (!selectedPreset || !leagueName.trim()) return;

    const settings: Record<string, unknown> = {};

    if (isDivisionConference) {
      settings.divisions = divisions;
    }

    if (isBoxing && weightClassesRaw.trim()) {
      settings.weightClasses = weightClassesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (isCircuit) {
      settings.raceCount = raceCount;
    }

    // Real days between matchdays: drives the background auto-advance cadence.
    settings.matchIntervalDays = matchIntervalDays;

    try {
      const result = await charter({
        name: leagueName.trim(),
        sportPreset: selectedPreset.key,
        teamCount,
        nationAffiliation: null,
        settings,
        isCanonical,
        wikiSlug: toWikiSlug(wiki.wikiSlug),
        teams: wiki.teams?.length === teamCount ? wiki.teams : undefined,
      });

      setCreatedLeagueId(result.id);
      onCreated?.(result.id);
      setCurrentStep(4);
      notify.success("League created", `${leagueName.trim()} has been established.`);
    } catch (_err) {
      notify.error("Failed to create league", "An error occurred while creating the league.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPreset,
    leagueName,
    teamCount,
    divisions,
    weightClassesRaw,
    raceCount,
    matchIntervalDays,
    isDivisionConference,
    isBoxing,
    isCircuit,
    charter,
    notify,
    onCreated,
    coverImage,
    wiki,
  ]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetForm();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, resetForm]
  );

  // Step indicator
  const totalSteps = 4;

  const stepIndicator = (
    <div className="mb-6 flex items-center justify-center gap-2 pt-4">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isDone = step < currentStep;
        return (
          <React.Fragment key={step}>
            {i > 0 && (
              <div
                className={cn(
                  "duration-fast h-px w-6 transition-colors",
                  isDone ? "bg-tint" : "bg-separator"
                )}
              />
            )}
            <div
              className={cn(
                "text-footnote duration-fast flex size-7 items-center justify-center rounded-full font-medium tabular-nums transition-colors",
                isActive && "bg-tint text-on-tint",
                isDone && "bg-tint-fill text-tint",
                !isActive && !isDone && "bg-fill-3 text-label-secondary"
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : step}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // Step 1: Pick Sport
  const renderStep1 = () => (
    <motion.div
      key="step-1"
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={springSmooth}
      className="space-y-4"
    >
      <DialogDescription>Choose a sport to build your league around.</DialogDescription>

      {presetsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-label-secondary h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(presets ?? []).map((preset) => {
            const isSelected = selectedPresetKey === preset.key;

            return (
              <motion.button
                key={preset.key}
                variants={cardVariants}
                initial="rest"
                whileHover="hover"
                whileTap="tap"
                onClick={() => handleSportSelect(preset.key)}
                aria-pressed={isSelected}
                className={cn(
                  "group focus-visible:outline-tint rounded-row duration-fast ease-out-facet relative cursor-pointer border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                  isSelected
                    ? "border-tint bg-tint-fill"
                    : "border-separator bg-surface hover:bg-fill-4"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-large-title mt-0.5 leading-none">{preset.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-label text-headline">{preset.name}</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={() => setCurrentStep(2)} disabled={!canNextStep1}>
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );

  // Step 2: Configure League
  const renderStep2 = () => (
    <motion.div
      key="step-2"
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={springSmooth}
      className="space-y-5"
    >
      <DialogDescription>
        Configure the details for your {selectedPreset?.icon} {selectedPreset?.name} league.
      </DialogDescription>

      {/* League name */}
      <div className="space-y-2">
        <Label htmlFor="league-name">League name</Label>
        <Input
          id="league-name"
          placeholder="Enter league name"
          value={leagueName}
          onChange={(e) => setLeagueName(e.target.value.slice(0, 100))}
          maxLength={100}
        />
        <p className="text-label-secondary text-footnote">{leagueName.length}/100 characters</p>
      </div>

      {/* Team Count */}
      <div className="space-y-2">
        <Label htmlFor="team-count">
          Number of Teams ({selectedPreset?.minTeamCount}–{selectedPreset?.maxTeamCount})
        </Label>
        <Input
          id="team-count"
          type="number"
          min={selectedPreset?.minTeamCount ?? 2}
          max={selectedPreset?.maxTeamCount ?? 64}
          value={teamCount}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
              const clamped = Math.min(
                Math.max(val, selectedPreset?.minTeamCount ?? 2),
                selectedPreset?.maxTeamCount ?? 64
              );
              setTeamCount(clamped);
              dispatchWiki({ type: "teamCountEdited", teamCount: clamped });
            } else if (e.target.value === "") {
              setTeamCount(0);
              dispatchWiki({ type: "teamCountEdited", teamCount: 0 });
            }
          }}
        />
      </div>

      {/* Wiki article and team import */}
      <LeagueWikiImport
        wikiSlug={wiki.wikiSlug}
        onWikiSlugChange={(wikiSlug) => dispatchWiki({ type: "slugEdited", wikiSlug })}
        importedCount={wiki.teams?.length ?? null}
        minTeams={selectedPreset?.minTeamCount ?? 2}
        maxTeams={selectedPreset?.maxTeamCount ?? 64}
        onImport={(teams) => {
          dispatchWiki({ type: "teamsImported", teams });
          setTeamCount(teams.length);
        }}
        onClear={() => dispatchWiki({ type: "teamsCleared" })}
      />

      {/* Match cadence (table-based archetypes) */}
      {!isCircuit && !isBoxing && (
        <div className="space-y-2">
          <Label htmlFor="match-interval">Days between matchdays</Label>
          <Input
            id="match-interval"
            type="number"
            min={0.5}
            max={30}
            step={0.5}
            value={matchIntervalDays}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setMatchIntervalDays(Math.min(30, Math.max(0.5, val)));
              else if (e.target.value === "") setMatchIntervalDays(0);
            }}
          />
          <p className="text-label-secondary text-footnote">
            Matches auto-resolve in the background, {intervalLabel(matchIntervalDays)} apart. Use 7
            for a weekly schedule.
          </p>
        </div>
      )}

      {/* Divisions (only for division_conference) */}
      {isDivisionConference && (
        <div className="space-y-2">
          <Label htmlFor="divisions">Number of divisions</Label>
          <Input
            id="divisions"
            type="number"
            min={2}
            max={Math.floor(teamCount / 2)}
            value={divisions}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 2) setDivisions(val);
              else if (e.target.value === "") setDivisions(0);
            }}
          />
          <p className="text-label-secondary text-footnote">
            Teams will be split across {divisions} divisions for the regular season.
          </p>
        </div>
      )}

      {/* Weight Classes (only for boxing/bracket sports marked as boxing) */}
      {isBoxing && (
        <div className="space-y-2">
          <Label htmlFor="weight-classes">Weight classes</Label>
          <Input
            id="weight-classes"
            placeholder="Heavyweight, Middleweight, Welterweight"
            value={weightClassesRaw}
            onChange={(e) => setWeightClassesRaw(e.target.value)}
          />
          <p className="text-label-secondary text-footnote">Comma-separated weight class names.</p>
        </div>
      )}

      {/* Race Count (only for circuit/F1) */}
      {isCircuit && (
        <div className="space-y-2">
          <Label htmlFor="race-count">Number of Races (16–22)</Label>
          <Input
            id="race-count"
            type="number"
            min={16}
            max={22}
            value={raceCount}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                setRaceCount(Math.min(22, Math.max(16, val)));
              } else if (e.target.value === "") {
                setRaceCount(0);
              }
            }}
          />
          <p className="text-label-secondary text-footnote">
            Points championship across {raceCount} race weekends.
          </p>
        </div>
      )}

      <LeagueCoverField
        coverImage={coverImage}
        loading={commonsLoading}
        suggestionCount={commonsData?.images?.length ?? 0}
        onShuffle={handleShuffleCover}
        onBrowse={() => setMediaSearchOpen(true)}
        onRemove={handleRemoveCover}
      />

      {/* Archetype preview */}
      {archetypeLabel && (
        <div className="border-separator bg-fill-3 rounded-control border px-3 py-3">
          <p className="text-label-secondary text-footnote leading-relaxed">
            <span className="text-label font-medium">{archetypeLabel}</span>
            {" · "}
            {selectedPreset?.federationName}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={() => setCurrentStep(1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={() => setCurrentStep(3)} disabled={!canNextStep2}>
          Review
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );

  // Step 3: Review & Create
  const renderStep3 = () => {
    const weightClasses = isBoxing
      ? weightClassesRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;

    return (
      <motion.div
        key="step-3"
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={springSmooth}
        className="space-y-5"
      >
        <DialogDescription>Review your league configuration before creating it.</DialogDescription>

        <Card className="flex flex-col gap-6 overflow-hidden py-6">
          {coverImage && (
            <div className="relative h-36 w-full overflow-hidden">
              <img
                src={assetUrl(coverImage) ?? undefined}
                alt="League cover"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="text-large-title">{selectedPreset?.icon}</span>
              <div>
                <CardTitle>{leagueName || "(unnamed league)"}</CardTitle>
                <p className="text-label-secondary text-body">{selectedPreset?.name}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-separator h-px" />

            <div className="text-body grid grid-cols-2 gap-3">
              <div>
                <span className="text-label-secondary text-footnote">Archetype</span>
                <p className="text-label font-medium">{archetypeLabel ?? "—"}</p>
              </div>
              <div>
                <span className="text-label-secondary text-footnote">Teams</span>
                <p className="text-label font-medium">
                  {teamCount}
                  {wiki.teams?.length === teamCount && " (from the wiki)"}
                </p>
              </div>
              {toWikiSlug(wiki.wikiSlug) && (
                <div>
                  <span className="text-label-secondary text-footnote">Wiki article</span>
                  <p className="text-label font-medium break-words">
                    {toWikiSlug(wiki.wikiSlug)?.replace(/_/g, " ")}
                  </p>
                </div>
              )}

              {isDivisionConference && (
                <div>
                  <span className="text-label-secondary text-footnote">Divisions</span>
                  <p className="text-label font-medium">{divisions}</p>
                </div>
              )}

              {isBoxing && weightClasses && weightClasses.length > 0 && (
                <div className="col-span-2">
                  <span className="text-label-secondary text-footnote">Weight classes</span>
                  <p className="text-label font-medium">{weightClasses.join(", ")}</p>
                </div>
              )}

              {isCircuit && (
                <div>
                  <span className="text-label-secondary text-footnote">Races</span>
                  <p className="text-label font-medium">{raceCount}</p>
                </div>
              )}
            </div>

            <div className="bg-separator h-px" />

            <div>
              <span className="text-label-secondary text-footnote">
                {isBoxing
                  ? "Each weight class runs a single-elimination bracket."
                  : isCircuit
                    ? `All ${teamCount} teams compete in ${raceCount} race weekends with points.`
                    : isDivisionConference
                      ? `Divisions feed into a seeded playoff bracket.`
                      : `Table-based competition with ${teamCount} teams.`}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(2)}
            disabled={createMutation.isPending}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Trophy className="h-4 w-4" />
                Create league
              </>
            )}
          </Button>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={!createMutation.isPending}
          className={cn(currentStep === 1 ? "sm:max-w-xl" : "sm:max-w-lg")}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            padding: 0,
            maxHeight: "85vh",
            overflow: "hidden",
          }}
        >
          <DialogHeader className="shrink-0 px-6 pt-6 pb-0">
            <DialogTitle>Create a league</DialogTitle>
          </DialogHeader>

          <div className="shrink-0 px-6 pt-4 pb-0">{stepIndicator}</div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <AnimatePresence mode="wait">
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && (
                <LeagueCreatedStep
                  icon={selectedPreset?.icon}
                  leagueName={leagueName}
                  onView={handleViewLeague}
                  onCreateAnother={handleCreateAnother}
                />
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {mediaSearchOpen && (
        <MediaSearchModal
          isOpen={mediaSearchOpen}
          onClose={() => setMediaSearchOpen(false)}
          onImageSelect={(url) => {
            setCoverImage(url);
            setMediaSearchOpen(false);
          }}
        />
      )}
    </>
  );
}
