"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Loader2,
  Trophy,
  Users,
  Shield,
  MapPin,
  Calendar,
  Flame,
  TrendingUp,
  BadgeCheck,
  UserPlus,
  Wallet,
  Settings,
} from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { TeamSettingsModal } from "./TeamSettingsModal";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { SPORT_PRESETS, type SportPreset } from "~/lib/sports/presets";
import PlayerStats from "~/components/sports/player-stats/PlayerStats1";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeamRosterModalProps {
  teamId: string;
  leagueId: string;
  sportPreset: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PlayerAttributes {
  overall?: number;
  [key: string]: number | undefined;
}

// ─── Attribute badge styling ────────────────────────────────────────────────

function attributeBadgeClass(value: number): string {
  if (value >= 90) return "bg-amber-400/20 text-amber-600 dark:text-amber-400 border-amber-400/40";
  if (value >= 80) return "bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 border-emerald-400/40";
  if (value >= 70) return "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40";
  return "bg-muted/60 text-muted-foreground border-border";
}

function attributeProgressColor(value: number): string {
  if (value >= 90) return "bg-amber-400";
  if (value >= 80) return "bg-emerald-400";
  if (value >= 70) return "bg-amber-500";
  return "bg-muted-foreground/50";
}

// ─── Career stage styling ───────────────────────────────────────────────────

const CAREER_STAGE_STYLES: Record<string, { label: string; className: string }> = {
  rookie: { label: "Rookie", className: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  developing: { label: "Developing", className: "border-green-500/30 bg-green-500/10 text-green-400" },
  prime: { label: "Prime", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  plateau: { label: "Plateau", className: "border-slate-500/30 bg-muted/60 text-muted-foreground" },
  declining: { label: "Declining", className: "border-red-500/30 bg-red-500/10 text-red-400" },
  retired: { label: "Retired", className: "border-gray-500/30 bg-gray-500/10 text-gray-500" },
};

// ─── Animation variants ─────────────────────────────────────────────────────

const playerRowVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.25 },
  }),
};

const expandVariants = {
  collapsed: { height: 0, opacity: 0, overflow: "hidden" },
  expanded: { height: "auto", opacity: 1, overflow: "hidden" },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function TeamRosterModal({
  teamId,
  leagueId: _leagueId,
  sportPreset,
  isOpen,
  onClose,
}: TeamRosterModalProps) {
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  // ── Data ────────────────────────────────────────────────────────────────

  const { data: team, isLoading } = api.sports.getTeam.useQuery(
    { id: teamId },
    { enabled: isOpen && !!teamId }
  );

  const { data: myClubs } = api.sports.getMyClubs.useQuery(undefined, {
    enabled: isOpen && !!user,
  });

  // ── State ───────────────────────────────────────────────────────────────

  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [showInvokeSaint, setShowInvokeSaint] = useState(false);
  const [saintName, setSaintName] = useState("");
  const [listingPlayer, setListingPlayer] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState(100);
  const [isClaiming, setIsClaiming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Derived ─────────────────────────────────────────────────────────────

  const preset = useMemo<SportPreset | undefined>(
    () => SPORT_PRESETS.find((p) => p.key === sportPreset),
    [sportPreset]
  );

  const isOwner = team && user ? team.ownerUserId === user.id : false;

  const { starters, bench } = useMemo(() => {
    if (!team?.players || !preset) return { starters: [], bench: [] };
    const slots = preset.startingSlots;
    const used: Record<string, number> = {};
    const s: any[] = [];
    const b: any[] = [];
    for (const player of team.players) {
      const posSlot = slots[player.position] ?? 0;
      const usedForPos = used[player.position] ?? 0;
      if (posSlot > 0 && usedForPos < posSlot) {
        s.push(player);
        used[player.position] = usedForPos + 1;
      } else {
        b.push(player);
      }
    }
    return { starters: s, bench: b };
  }, [team, preset]);

  const coachName = useMemo(() => {
    if (!team?.coaches || team.coaches.length === 0) return null;
    const headCoach = team.coaches.find(
      (c) => c.role === "head_coach" || c.role === "manager"
    );
    const c = headCoach ?? team.coaches[0];
    return c ? `${c.firstName} ${c.lastName}` : null;
  }, [team]);

  const teamElo = useMemo(() => {
    if (!team?.players || team.players.length === 0) return 50;
    const total = team.players.reduce((sum, p) => {
      const ratings = (p.ratings as PlayerAttributes) ?? {};
      return sum + (ratings.overall ?? 50);
    }, 0);
    return Math.round(total / team.players.length);
  }, [team]);

  // ── Mutations ───────────────────────────────────────────────────────────

  const claimTeam = api.sports.claimTeam.useMutation({
    onSuccess: () => {
      notify.success("Franchise Claimed", "You are now the owner of this team!");
      utils.sports.getTeam.invalidate({ id: teamId });
      utils.sports.getMyClubs.invalidate();
      setIsClaiming(false);
    },
    onError: (err) => {
      notify.error("Claim Failed", err.message);
      setIsClaiming(false);
    },
  });

  const invokePatronSaint = api.sports.invokePatronSaint.useMutation({
    onSuccess: () => {
      notify.success("Patron Saint Invoked", `${saintName}'s blessing descends upon the pitch!`);
      utils.sports.getTeam.invalidate({ id: teamId });
      setShowInvokeSaint(false);
      setSaintName("");
    },
    onError: (err) => {
      notify.error("Invocation Failed", err.message);
    },
  });

  const listPlayerMutation = api.sports.listPlayerForTransfer.useMutation({
    onSuccess: () => {
      notify.success("Player Listed", "Player now available on the transfer market.");
      setListingPlayer(null);
      utils.sports.getTeam.invalidate({ id: teamId });
      utils.sports.getOpenTransferListings.invalidate();
    },
    onError: (err) => {
      notify.error("Failed to List", err.message);
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleClaim = () => {
    setIsClaiming(true);
    claimTeam.mutate({ teamId });
  };

  const handleInvokeSaint = () => {
    if (!saintName.trim()) return;
    invokePatronSaint.mutate({ teamId, saintName: saintName.trim() });
  };

  const handleListPlayer = (playerId: string) => {
    listPlayerMutation.mutate({ playerId, price: listPrice });
  };

  const handlePlayerClick = (playerId: string) => {
    setExpandedPlayerId(expandedPlayerId === playerId ? null : playerId);
  };

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderAttributeGrid = (player: any) => {
    return (
      <motion.div
        variants={expandVariants}
        initial="collapsed"
        animate="expanded"
        exit="collapsed"
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="overflow-hidden mb-3"
      >
        <PlayerStats player={player} team={team} />
      </motion.div>
    );
  };

  const renderPlayerRow = (player: any, index: number) => {
    const ratings = (player.ratings as Record<string, number>) ?? {};
    const overall = ratings.overall ?? 50;
    const isExpanded = expandedPlayerId === player.id;
    const isListing = listingPlayer === player.id;

    return (
      <motion.div
        key={player.id}
        custom={index}
        variants={playerRowVariants}
        initial="hidden"
        animate="visible"
        className="group"
      >
        <button
          type="button"
          onClick={() => handlePlayerClick(player.id)}
          className={cn(
            "hover:bg-muted/40 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
            isExpanded && "bg-muted/50"
          )}
        >
          {/* # Number */}
          {player.number && (
            <span className="w-7 text-center text-xs font-bold text-foreground/15 tabular-nums">
              #{player.number}
            </span>
          )}

          {/* Name + meta */}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {player.firstName} {player.lastName}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="rounded px-1 py-0 text-[10px] font-medium border-border/30 bg-muted/50 text-muted-foreground"
              >
                {player.position}
              </Badge>
              <span className="text-[10px] text-muted-foreground/70">Age {player.age}</span>
            </div>
          </div>

          {/* Overall rating */}
          <div className="flex shrink-0 items-center gap-2">
            {isOwner && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setListingPlayer(isListing ? null : player.id);
                }}
                className="rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-muted"
                title="List on transfer market"
              >
                <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold",
                overall >= 80
                  ? "bg-amber-400/15 text-amber-400"
                  : overall >= 70
                    ? "bg-emerald-400/15 text-emerald-400"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {overall}
            </span>
          </div>
        </button>

        {/* Inline listing form */}
        <AnimatePresence>
          {isListing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-border/30 bg-muted/20 mx-3 mb-2 flex items-center gap-2 rounded-lg border p-3">
                <Label className="sr-only" htmlFor={`price-${player.id}`}>
                  Price
                </Label>
                <Input
                  id={`price-${player.id}`}
                  type="number"
                  min={1}
                  value={listPrice}
                  onChange={(e) => setListPrice(Number(e.target.value) || 1)}
                  className="h-8 w-24 border-border/50 bg-muted/50 text-xs text-foreground"
                />
                <span className="text-xs text-muted-foreground">credits</span>
                <Button
                  size="sm"
                  onClick={() => handleListPlayer(player.id)}
                  disabled={listPlayerMutation.isPending}
                  className="h-8 text-xs"
                >
                  {listPlayerMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  List
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setListingPlayer(null)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded attribute grid */}
        <AnimatePresence>{isExpanded && renderAttributeGrid(player)}</AnimatePresence>
      </motion.div>
    );
  };

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full border-border/50 bg-background/95 p-0 backdrop-blur-2xl sm:max-w-lg"
        >
          <SheetTitle className="sr-only">Team Roster</SheetTitle>
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
            <span className="text-sm text-muted-foreground/70">Loading roster...</span>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────

  if (!team) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full border-border/50 bg-background/95 p-0 backdrop-blur-2xl sm:max-w-lg"
        >
          <SheetTitle className="sr-only">Team Roster</SheetTitle>
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <Shield className="h-8 w-8 text-muted-foreground/40" />
            <span className="text-sm text-muted-foreground/70">Team not found</span>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────

  const teamColor = team.color ?? "#3b82f6";

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full border-border/50 bg-background/95 p-0 backdrop-blur-2xl sm:max-w-lg [&>button]:hidden"
        >
          <div className="flex h-full flex-col">
            {/* ── 1. Dynamic Team Header ─────────────────────────────────── */}
            <div
              className="relative shrink-0 border-b border-border/30 px-5 py-5 overflow-hidden"
              style={{ borderLeft: `3px solid ${teamColor}` }}
            >
              {team.coverImage && (
                <div className="absolute inset-0 z-0">
                  <img
                    src={team.coverImage}
                    alt=""
                    className="h-full w-full object-cover opacity-10 filter blur-[1px]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent" />
                </div>
              )}
              <div className="relative z-10">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-0 right-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-black shadow-lg overflow-hidden"
                    style={{ backgroundColor: `${teamColor}20`, color: teamColor }}
                  >
                    {team.logo ? (
                      <img src={team.logo} alt="Club logo" className="h-full w-full object-cover" />
                    ) : (
                      team.shortName?.slice(0, 2) ?? team.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <SheetTitle className="truncate text-lg font-bold text-foreground">
                        {team.name}
                      </SheetTitle>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          onClick={() => setSettingsOpen(true)}
                          title="Club Settings"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {team.shortName && (
                      <span className="text-xs text-muted-foreground/70">{team.shortName}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Team metadata row */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {team.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {team.city}
                </span>
              )}
              {team.nation?.name && (
                <span className="inline-flex items-center gap-1">
                  <Shield className="h-3 w-3" /> {team.nation.name}
                </span>
              )}
              {coachName && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {coachName}
                </span>
              )}
              {team.stadiumCapacity > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {team.stadiumCapacity.toLocaleString()} capacity
                </span>
              )}
              {team.patronSaint && (
                <span className="inline-flex items-center gap-1 text-amber-400/80">
                  <Flame className="h-3 w-3" /> {team.patronSaint}
                </span>
              )}
            </div>

            {/* ELO / Budget summary */}
            <div className="mt-3 flex gap-3">
              <div className="border-border/30 bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs text-muted-foreground">Rating</span>
                <span className="text-sm font-bold text-foreground">{teamElo}</span>
              </div>
              {team.popularity != null && (
                <div className="border-border/30 bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-muted-foreground">Popularity</span>
                  <span className="text-sm font-bold text-foreground">
                    {Math.round(team.popularity)}
                  </span>
                </div>
              )}
              {team.budget != null && (
                <div className="border-border/30 bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-1.5">
                  <Wallet className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs text-muted-foreground">Budget</span>
                  <span className="text-sm font-bold text-foreground">
                    {team.budget.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── 2. Contextual Actions Bar ──────────────────────────────── */}
          <div className="shrink-0 border-b border-border/30 px-5 py-3">
            {!team.ownerUserId && (
              <Button
                onClick={handleClaim}
                disabled={isClaiming || claimTeam.isPending || !user}
                className="w-full gap-2 hover:opacity-95 transition-all"
                style={{
                  backgroundColor: team.color ? `${team.color}15` : undefined,
                  color: team.color ?? undefined,
                  border: team.color ? `1px solid ${team.color}30` : undefined,
                }}
                size="sm"
              >
                {isClaiming || claimTeam.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BadgeCheck className="h-4 w-4" />
                )}
                Claim Franchise (50 Credits)
              </Button>
            )}

            {isOwner && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInvokeSaint(!showInvokeSaint)}
                  className="w-full hover:opacity-95 transition-all"
                  style={{
                    border: team.color ? `1px solid ${team.color}20` : undefined,
                    backgroundColor: team.color ? `${team.color}0d` : undefined,
                    color: team.color ?? undefined,
                  }}
                >
                  <Flame className="mr-1.5 h-4 w-4" />
                  Invoke Patron Saint
                </Button>

                <AnimatePresence>
                  {showInvokeSaint && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="flex items-center gap-2 rounded-lg bg-muted/20 p-3"
                        style={{
                          boxShadow: team.color ? `0 0 0 1px ${team.color}20` : undefined,
                        }}
                      >
                        <Input
                          value={saintName}
                          onChange={(e) => setSaintName(e.target.value)}
                          placeholder="Enter saint name..."
                          className="h-8 flex-1 border-border/50 bg-muted/50 text-xs text-foreground placeholder:text-muted-foreground/40"
                          onKeyDown={(e) => e.key === "Enter" && handleInvokeSaint()}
                        />
                        <Button
                          size="sm"
                          onClick={handleInvokeSaint}
                          disabled={invokePatronSaint.isPending || !saintName.trim()}
                          className="h-8 text-xs"
                        >
                          {invokePatronSaint.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          Invoke (100c)
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ── 3. Interactive Roster List ─────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            {/* Starters */}
            {starters.length > 0 && (
              <div className="px-5 pt-4 pb-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Starters
                </h4>
              </div>
            )}
            <div className="divide-y divide-border/10">
              {starters.map((player, i) => renderPlayerRow(player, i))}
            </div>

            {/* Bench */}
            {bench.length > 0 && (
              <div className="px-5 pt-5 pb-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Bench
                </h4>
              </div>
            )}
            <div className="divide-y divide-border/10">
              {bench.map((player, i) => renderPlayerRow(player, starters.length + i))}
            </div>

            {/* Coaches section */}
            {team.coaches && team.coaches.length > 0 && (
              <>
                <div className="px-5 pt-5 pb-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    Coaching Staff
                  </h4>
                </div>
                <div className="divide-y divide-border/10">
                  {team.coaches.map((coach) => (
                    <div
                      key={coach.id}
                      className="flex items-center gap-3 px-5 py-2.5 text-sm"
                    >
                      <span className="text-xs font-medium text-muted-foreground">{coach.role}</span>
                      <span className="text-foreground">
                        {coach.firstName} {coach.lastName}
                      </span>
                      {coach.age && (
                        <span className="ml-auto text-xs text-muted-foreground/70">Age {coach.age}</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Season history summary */}
            {team.seasons && team.seasons.length > 0 && (
              <>
                <div className="px-5 pt-5 pb-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    Season History
                  </h4>
                </div>
                <div className="divide-y divide-border/10 pb-4">
                  {team.seasons.slice(0, 5).map((ts) => (
                    <div
                      key={ts.season.id}
                      className="flex items-center gap-3 px-5 py-2 text-sm"
                    >
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/40" />
                      <span className="text-foreground">Season {ts.season.seasonNumber}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded px-1.5 py-0 text-[10px]",
                          ts.season.status === "in_progress"
                            ? "border-green-500/30 bg-green-500/10 text-green-400"
                            : ts.season.status === "completed"
                              ? "border-slate-500/30 bg-muted/60 text-muted-foreground"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        )}
                      >
                        {ts.season.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Empty roster */}
            {starters.length === 0 && bench.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <span className="text-sm text-muted-foreground/70">No active players on roster</span>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TeamSettingsModal
        team={{
          id: team.id,
          name: team.name,
          logo: team.logo,
          coverImage: team.coverImage,
          color: team.color ?? "#3b82f6",
        }}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
}

export default TeamRosterModal;
