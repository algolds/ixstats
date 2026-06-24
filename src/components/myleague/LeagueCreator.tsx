"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  Trophy,
  RotateCcw,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
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
import { withBasePath } from "~/lib/base-path";
import type { ArchetypeType } from "~/lib/sports";

const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

const archetypeLabels: Record<ArchetypeType, string> = {
  league: "League",
  division_conference: "Division / Conference",
  bracket: "Bracket",
  circuit: "Circuit",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface LeagueCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (leagueId: string) => void;
  isCanonical?: boolean;
}

// ─── Animation variants ─────────────────────────────────────────────────────

const stepVariants = {
  enter: { opacity: 0, x: 40, scale: 0.98 },
  center: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -40, scale: 0.98 },
};

const cardVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2 } },
  tap: { scale: 0.98 },
};

const SPORT_COMMONS_CATEGORIES: Record<string, string> = {
  soccer: "Association football stadiums",
  football: "American football stadiums",
  hockey: "Ice hockey arenas",
  basketball: "Basketball venues",
  baseball: "Baseball stadiums",
  f1: "Formula One circuits",
  boxing: "Boxing matches",
};

// ─── Component ──────────────────────────────────────────────────────────────

export function LeagueCreator({
  open,
  onOpenChange,
  onCreated,
  isCanonical = false,
}: LeagueCreatorProps) {
  const notify = useNotify();

  // ── Presets query ───────────────────────────────────────────────────────
  const { data: presets, isLoading: presetsLoading } = api.sports.getSportPresets.useQuery(
    undefined,
    { enabled: open }
  );

  // ── Create league mutation ──────────────────────────────────────────────
  const createMutation = api.sports.createLeague.useMutation();

  // ── Wizard state ────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);
  const [createdLeagueId, setCreatedLeagueId] = useState<string | null>(null);

  // Form fields
  const [leagueName, setLeagueName] = useState("");
  const [teamCount, setTeamCount] = useState(20);
  const [divisions, setDivisions] = useState(2);
  const [weightClassesRaw, setWeightClassesRaw] = useState("");
  const [raceCount, setRaceCount] = useState(20);
  const [matchIntervalDays, setMatchIntervalDays] = useState(1);

  // Cover image suggestion states
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [autoSelectedForPreset, setAutoSelectedForPreset] = useState<string | null>(null);
  const [mediaSearchOpen, setMediaSearchOpen] = useState(false);

  // Commons category query
  const activeCategory = selectedPresetKey ? SPORT_COMMONS_CATEGORIES[selectedPresetKey] : null;
  const { data: commonsData, isLoading: commonsLoading } = api.commons.getCategoryFiles.useQuery(
    {
      category: activeCategory ?? "",
      limit: 35,
    },
    {
      enabled: !!open && !!activeCategory && currentStep >= 2,
    }
  );

  useEffect(() => {
    if (selectedPresetKey !== autoSelectedForPreset) {
      setAutoSelectedForPreset(null);
    }
  }, [selectedPresetKey, autoSelectedForPreset]);

  useEffect(() => {
    if (
      commonsData?.images &&
      commonsData.images.length > 0 &&
      selectedPresetKey &&
      autoSelectedForPreset !== selectedPresetKey &&
      !coverImage
    ) {
      const randomIndex = Math.floor(Math.random() * commonsData.images.length);
      const suggestedImage = commonsData.images[randomIndex]?.url ?? null;
      if (suggestedImage) {
        setCoverImage(suggestedImage);
        setAutoSelectedForPreset(selectedPresetKey);
      }
    }
  }, [commonsData, selectedPresetKey, autoSelectedForPreset, coverImage]);

  const handleShuffleCover = useCallback(() => {
    if (!commonsData?.images || commonsData.images.length === 0) return;
    const available = commonsData.images.filter((img) => img.url !== coverImage);
    if (available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length);
      const newUrl = available[randomIndex]?.url;
      if (newUrl) {
        setCoverImage(newUrl);
      }
    } else {
      const randomIndex = Math.floor(Math.random() * commonsData.images.length);
      const newUrl = commonsData.images[randomIndex]?.url;
      if (newUrl) {
        setCoverImage(newUrl);
      }
    }
  }, [commonsData, coverImage]);

  const handleRemoveCover = useCallback(() => {
    setCoverImage(null);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────
  const selectedPreset = useMemo(() => {
    if (!presets || !selectedPresetKey) return null;
    return presets.find((p) => p.key === selectedPresetKey) ?? null;
  }, [presets, selectedPresetKey]);

  const archetype = selectedPreset?.archetype as ArchetypeType | undefined;
  const archetypeLabel = archetype ? archetypeLabels[archetype] : null;

  const isDivisionConference = archetype === "division_conference";
  const isBracket = archetype === "bracket";
  const isCircuit = archetype === "circuit";
  // Boxing has bracket archetype
  const isBoxing = selectedPresetKey === "boxing";

  const canNextStep1 = !!selectedPresetKey;
  const canNextStep2 =
    leagueName.trim().length > 0 && teamCount >= (selectedPreset?.minTeamCount ?? 2);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSportSelect = useCallback(
    (key: string) => {
      setSelectedPresetKey(key);
      const preset = presets?.find((p) => p.key === key);
      if (preset) {
        setTeamCount(preset.defaultTeamCount);
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
    setCoverImage(null);
    setAutoSelectedForPreset(null);
    setMediaSearchOpen(false);
  }, []);

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

    // IxTime days between matchdays — drives the background auto-advance cadence.
    settings.matchIntervalDays = matchIntervalDays;

    try {
      const result = await createMutation.mutateAsync({
        name: leagueName.trim(),
        sportPreset: selectedPreset.key,
        teamCount,
        nationAffiliation: null,
        settings,
        isCanonical,
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
    createMutation,
    notify,
    onCreated,
    coverImage,
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

  // ── Step indicator ──────────────────────────────────────────────────────
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
                  "h-px w-6 transition-colors duration-300",
                  isDone ? "bg-primary/60" : "bg-border"
                )}
              />
            )}
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all duration-300",
                isActive &&
                  "bg-primary text-primary-foreground ring-primary/40 ring-offset-background shadow-md ring-2 ring-offset-2",
                isDone && "bg-primary/20 text-primary",
                !isActive && !isDone && "bg-muted text-muted-foreground"
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : step}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // ── Step 1: Pick Sport ─────────────────────────────────────────────────
  const renderStep1 = () => (
    <motion.div
      key="step-1"
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      <DialogDescription>Choose a sport to build your league around.</DialogDescription>

      {presetsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
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
                className={cn(
                  "facet-hierarchy-interactive group focus:ring-primary/30 relative cursor-pointer rounded-xl border p-4 text-left transition-all focus:ring-2 focus:outline-none",
                  isSelected
                    ? "border-primary/60 bg-primary/5 ring-primary ring-2"
                    : "border-border/60 bg-card/50 hover:border-border hover:bg-card/80"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-3xl leading-none">{preset.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-sm font-semibold">{preset.name}</span>
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

  // ── Step 2: Configure League ────────────────────────────────────────────
  const renderStep2 = () => (
    <motion.div
      key="step-2"
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <DialogDescription>
        Configure the details for your {selectedPreset?.icon} {selectedPreset?.name} league.
      </DialogDescription>

      {/* League Name */}
      <div className="space-y-1.5">
        <Label htmlFor="league-name">League Name</Label>
        <Input
          id="league-name"
          placeholder="Enter league name"
          value={leagueName}
          onChange={(e) => setLeagueName(e.target.value.slice(0, 100))}
          maxLength={100}
        />
        <p className="text-muted-foreground text-[11px]">{leagueName.length}/100 characters</p>
      </div>

      {/* Team Count */}
      <div className="space-y-1.5">
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
            } else if (e.target.value === "") {
              setTeamCount(0);
            }
          }}
        />
      </div>

      {/* Match cadence (table-based archetypes) */}
      {!isCircuit && !isBoxing && (
        <div className="space-y-1.5">
          <Label htmlFor="match-interval">IxDays Between Matchdays</Label>
          <Input
            id="match-interval"
            type="number"
            min={1}
            max={30}
            value={matchIntervalDays}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) setMatchIntervalDays(Math.min(30, Math.max(1, val)));
              else if (e.target.value === "") setMatchIntervalDays(0);
            }}
          />
          <p className="text-muted-foreground text-[11px]">
            Matches auto-resolve in the background on the IxTime clock. {matchIntervalDays} IxDay
            {matchIntervalDays === 1 ? "" : "s"} ≈ {(matchIntervalDays / 2).toLocaleString()}{" "}
            real-world day
            {matchIntervalDays === 2 ? "" : "s"} between matchdays. Use 7 for a weekly (in-world)
            schedule.
          </p>
        </div>
      )}

      {/* Divisions (only for division_conference) */}
      {isDivisionConference && (
        <div className="space-y-1.5">
          <Label htmlFor="divisions">Number of Divisions</Label>
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
          <p className="text-muted-foreground text-[11px]">
            Teams will be split across {divisions} divisions for the regular season.
          </p>
        </div>
      )}

      {/* Weight Classes (only for boxing/bracket sports marked as boxing) */}
      {isBoxing && (
        <div className="space-y-1.5">
          <Label htmlFor="weight-classes">Weight Classes</Label>
          <Input
            id="weight-classes"
            placeholder="Heavyweight, Middleweight, Welterweight"
            value={weightClassesRaw}
            onChange={(e) => setWeightClassesRaw(e.target.value)}
          />
          <p className="text-muted-foreground text-[11px]">Comma-separated weight class names.</p>
        </div>
      )}

      {/* Race Count (only for circuit/F1) */}
      {isCircuit && (
        <div className="space-y-1.5">
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
          <p className="text-muted-foreground text-[11px]">
            Points championship across {raceCount} race weekends.
          </p>
        </div>
      )}

      {/* League Cover Image */}
      <div className="space-y-2">
        <Label>League Cover Image</Label>

        {commonsLoading && !coverImage ? (
          <div className="border-border bg-muted/30 flex h-40 w-full items-center justify-center rounded-lg border border-dashed">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <span className="text-muted-foreground ml-2 text-xs">Fetching suggestion...</span>
          </div>
        ) : coverImage ? (
          <div className="group border-border relative h-40 w-full overflow-hidden rounded-lg border">
            <img
              src={withBasePath(coverImage)}
              alt="Suggested Cover"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={handleShuffleCover}
                disabled={!commonsData?.images || commonsData.images.length <= 1}
              >
                <RotateCcw className="h-3 w-3" />
                Shuffle
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setMediaSearchOpen(true)}
              >
                <ImageIcon className="h-3 w-3" />
                Browse
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={handleRemoveCover}
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-border bg-muted/30 flex h-40 w-full flex-col items-center justify-center rounded-lg border border-dashed p-4">
            <ImageIcon className="text-muted-foreground/60 mb-2 h-8 w-8" />
            <p className="text-muted-foreground mb-3 text-xs">No cover image selected</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setMediaSearchOpen(true)}
              >
                <ImageIcon className="h-3 w-3" />
                Browse Media
              </Button>
              {commonsData?.images && commonsData.images.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={handleShuffleCover}
                >
                  <RotateCcw className="h-3 w-3" />
                  Suggest Image
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Archetype preview */}
      {archetypeLabel && (
        <div className="border-border/50 bg-muted/50 rounded-lg border px-3 py-2.5">
          <p className="text-muted-foreground text-xs leading-relaxed">
            <span className="text-foreground font-medium">{archetypeLabel}</span>
            {" — "}
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

  // ── Step 3: Review & Create ─────────────────────────────────────────────
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
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-5"
      >
        <DialogDescription>Review your league configuration before creating it.</DialogDescription>

        <Card className="facet-hierarchy-child border-border/60 bg-card/50 overflow-hidden">
          {coverImage && (
            <div className="relative h-36 w-full overflow-hidden">
              <img
                src={withBasePath(coverImage)}
                alt="League Cover"
                className="h-full w-full object-cover"
              />
              <div className="from-background/90 via-background/45 absolute inset-0 bg-gradient-to-t to-transparent" />
            </div>
          )}
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedPreset?.icon}</span>
              <div>
                <CardTitle className="text-base">{leagueName || "(unnamed league)"}</CardTitle>
                <p className="text-muted-foreground text-sm">{selectedPreset?.name}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-border/60 h-px" />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Archetype</span>
                <p className="text-foreground font-medium">{archetypeLabel ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Teams</span>
                <p className="text-foreground font-medium">{teamCount}</p>
              </div>

              {isDivisionConference && (
                <div>
                  <span className="text-muted-foreground text-xs">Divisions</span>
                  <p className="text-foreground font-medium">{divisions}</p>
                </div>
              )}

              {isBoxing && weightClasses && weightClasses.length > 0 && (
                <div className="col-span-2">
                  <span className="text-muted-foreground text-xs">Weight Classes</span>
                  <p className="text-foreground font-medium">{weightClasses.join(", ")}</p>
                </div>
              )}

              {isCircuit && (
                <div>
                  <span className="text-muted-foreground text-xs">Races</span>
                  <p className="text-foreground font-medium">{raceCount}</p>
                </div>
              )}
            </div>

            <div className="bg-border/60 h-px" />

            <div>
              <span className="text-muted-foreground text-xs">
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
                Create League
              </>
            )}
          </Button>
        </div>
      </motion.div>
    );
  };

  // ── Step 4: Created! ───────────────────────────────────────────────────
  const renderStep4 = () => (
    <motion.div
      key="step-4"
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        >
          <span className="text-4xl">{selectedPreset?.icon}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-foreground text-lg font-semibold">League Created!</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {leagueName} is now active and ready for configuration.
          </p>
        </motion.div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={handleViewLeague} className="gap-2">
          View League
        </Button>
        <Button variant="outline" onClick={handleCreateAnother} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Create Another
        </Button>
      </div>
    </motion.div>
  );

  // ── Render ──────────────────────────────────────────────────────────────
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
            <DialogTitle>{currentStep === 4 ? "All Set!" : "Create a League"}</DialogTitle>
          </DialogHeader>

          <div className="shrink-0 px-6 pt-4 pb-0">{stepIndicator}</div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <AnimatePresence mode="wait">
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
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
