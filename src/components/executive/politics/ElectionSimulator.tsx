"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Vote, Plus, Play, UserPlus, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { api } from "~/trpc/react";
import { ParliamentHemicycle } from "./ParliamentHemicycle";
import { IxTime } from "~/lib/ixtime";
import { IxTimePicker } from "~/components/ui/ixtime-picker";

interface ElectionSimulatorProps {
  countryId: string;
}

export function ElectionSimulator({ countryId }: ElectionSimulatorProps) {
  const utils = api.useUtils();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [selectedElection, setSelectedElection] = useState<string | null>(null);
  const [expandedElection, setExpandedElection] = useState<string | null>(null);
  const [newElectionName, setNewElectionName] = useState("");
  const [newElectionType, setNewElectionType] = useState<"general" | "special" | "referendum">(
    "general"
  );
  const [candidateForm, setCandidateForm] = useState({
    partyId: "",
    candidateName: "",
    charisma: 50,
    politicalCapital: 50,
  });
  const [scheduledIxTime, setScheduledIxTime] = useState<number>(0);

  useEffect(() => {
    if (scheduleOpen) {
      setScheduledIxTime(IxTime.getCurrentIxTime());
    }
  }, [scheduleOpen]);

  const { data: elections = [], refetch: refetchElections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: parties = [] } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: parliament } = api.elections.getCurrentParliament.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Multi-chamber tabs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chambers = parliament?.legislature?.chambers ?? [];
  const [activeChamberTab, setActiveChamberTab] = useState<string>("");

  useEffect(() => {
    if (chambers.length > 0) {
      if (!activeChamberTab || !chambers.some((c) => c.name === activeChamberTab)) {
        setActiveChamberTab(chambers[0].name);
      }
    } else {
      setActiveChamberTab("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chambers]);

  // Dynamically filter seats and aggregate summary for the active chamber tab
  const activeChamberSeats = useMemo(() => {
    if (!parliament) return [];
    if (chambers.length <= 1) return parliament.seats;
    return parliament.seats.filter((s: any) => s.chamber === activeChamberTab);
  }, [parliament, chambers, activeChamberTab]);

  const activeChamberSeatsCount = useMemo(() => {
    if (!parliament) return 0;
    if (chambers.length <= 1) return parliament.legislature.totalSeats;
    const activeChamber = chambers.find((c: any) => c.name === activeChamberTab);
    return activeChamber ? activeChamber.seats : activeChamberSeats.length;
  }, [parliament, chambers, activeChamberTab, activeChamberSeats]);

  const activeChamberPartySummary = useMemo(() => {
    if (!parliament) return [];
    if (chambers.length <= 1) return parliament.partySummary;

    const counts = new Map<string, { party: any; seats: number }>();
    for (const seat of activeChamberSeats) {
      if (seat.partyId) {
        const existing = counts.get(seat.partyId);
        if (existing) {
          existing.seats++;
        } else {
          const refSummary = parliament.partySummary.find(
            (ps: any) => ps.party.id === seat.partyId
          );
          const partyObj = refSummary
            ? refSummary.party
            : {
                id: seat.partyId,
                name: seat.partyName,
                shortName: null,
                color: seat.partyColor,
                ideology: "center",
              };
          counts.set(seat.partyId, {
            party: partyObj,
            seats: 1,
          });
        }
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.seats - a.seats);
  }, [parliament, activeChamberSeats, chambers]);

  const scheduleElection = api.elections.scheduleElection.useMutation({
    onSuccess: () => {
      refetchElections();
      setScheduleOpen(false);
      setNewElectionName("");
    },
  });

  const registerCandidate = api.elections.registerCandidate.useMutation({
    onSuccess: () => {
      refetchElections();
      setCandidateOpen(false);
      setCandidateForm({ partyId: "", candidateName: "", charisma: 50, politicalCapital: 50 });
    },
  });

  const simulateElection = api.elections.simulateElection.useMutation({
    onSuccess: () => {
      refetchElections();
      utils.elections.getCurrentParliament.invalidate({ countryId });
      utils.elections.getLegislature.invalidate({ countryId });
    },
  });

  const completedElections = elections.filter((e: any) => e.status === "completed");
  const pendingElections = elections.filter(
    (e: any) => e.status !== "completed" && e.status !== "cancelled"
  );

  return (
    <div className="space-y-4">
      {/* Current Parliament Hemicycle */}
      {parliament && parliament.seats.length > 0 && (
        <Card className="glass-hierarchy-child border-amber-500/20">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-amber-600" />
                <CardTitle className="text-base">Current Parliament</CardTitle>
                {activeChamberSeatsCount > 0 && (
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {activeChamberSeatsCount} seats
                  </Badge>
                )}
              </div>
              {chambers.length > 1 && (
                <div className="mt-1 border-t border-slate-800 pt-2">
                  <Tabs value={activeChamberTab} onValueChange={setActiveChamberTab}>
                    <TabsList className="flex-wrap gap-1 bg-transparent p-0">
                      {chambers.map((chamber: any) => (
                        <TabsTrigger
                          key={chamber.name}
                          value={chamber.name}
                          className="animate-in fade-in zoom-in h-7 border border-slate-800 bg-slate-900 px-2.5 py-1 text-[10px] duration-200 data-[state=active]:border-indigo-600 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
                        >
                          {chamber.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ParliamentHemicycle
              seats={activeChamberSeats}
              totalSeats={activeChamberSeatsCount}
              partySummary={activeChamberPartySummary}
              legislatureName={chambers.length > 1 ? activeChamberTab : parliament.legislature.name}
            />
          </CardContent>
        </Card>
      )}

      {/* Election Controls */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Vote className="h-4 w-4 text-amber-600" />
              Elections
            </span>
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1" disabled={!legislature}>
                  <Plus className="h-3 w-3" /> Schedule Election
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule New Election</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Election Name</Label>
                    <Input
                      value={newElectionName}
                      onChange={(e) => setNewElectionName(e.target.value)}
                      placeholder="e.g. 2026 General Election"
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={newElectionType}
                      onValueChange={(v) => setNewElectionType(v as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Election</SelectItem>
                        <SelectItem value="special">Special Election</SelectItem>
                        <SelectItem value="referendum">Referendum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1 block">Scheduled Date (IxTime)</Label>
                    <IxTimePicker
                      value={scheduledIxTime}
                      onChange={setScheduledIxTime}
                      showRealWorldTime={true}
                    />
                  </div>
                  <Button
                    onClick={() =>
                      scheduleElection.mutate({
                        countryId,
                        name: newElectionName,
                        electionType: newElectionType,
                        scheduledIxTime: scheduledIxTime,
                      })
                    }
                    disabled={!newElectionName || scheduleElection.isPending}
                    className="w-full"
                  >
                    Schedule Election
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>
            {!legislature
              ? "Configure a legislature first to schedule elections"
              : `Schedule and simulate elections for your ${legislature.seats.length}-seat parliament`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pending Elections */}
          {pendingElections.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-muted-foreground text-sm font-medium">Upcoming Elections</h4>
              {pendingElections.map((election: any) => (
                <div
                  key={election.id}
                  className="rounded-lg border border-amber-200/50 bg-amber-50/30 p-3 dark:border-amber-800/30 dark:bg-amber-950/20"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium">{election.name}</h5>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {election.electionType}
                        </Badge>
                        <span>{election.candidates.length} candidates registered</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Add Candidate */}
                      <Dialog
                        open={candidateOpen && selectedElection === election.id}
                        onOpenChange={(open) => {
                          setCandidateOpen(open);
                          if (open) setSelectedElection(election.id);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1">
                            <UserPlus className="h-3 w-3" /> Add Candidate
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Register Candidate</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div>
                              <Label>Party</Label>
                              <Select
                                value={candidateForm.partyId}
                                onValueChange={(v) =>
                                  setCandidateForm({ ...candidateForm, partyId: v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select party" />
                                </SelectTrigger>
                                <SelectContent>
                                  {parties.map((p: any) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      <span className="flex items-center gap-2">
                                        <span
                                          className="h-2 w-2 rounded-full"
                                          style={{ backgroundColor: p.color }}
                                        />
                                        {p.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Candidate Name</Label>
                              <Input
                                value={candidateForm.candidateName}
                                onChange={(e) =>
                                  setCandidateForm({
                                    ...candidateForm,
                                    candidateName: e.target.value,
                                  })
                                }
                                placeholder="e.g. Maria Rodriguez"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Charisma ({candidateForm.charisma})</Label>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={candidateForm.charisma}
                                  onChange={(e) =>
                                    setCandidateForm({
                                      ...candidateForm,
                                      charisma: Number(e.target.value),
                                    })
                                  }
                                  className="w-full"
                                />
                              </div>
                              <div>
                                <Label>Political Capital ({candidateForm.politicalCapital})</Label>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={candidateForm.politicalCapital}
                                  onChange={(e) =>
                                    setCandidateForm({
                                      ...candidateForm,
                                      politicalCapital: Number(e.target.value),
                                    })
                                  }
                                  className="w-full"
                                />
                              </div>
                            </div>
                            <Button
                              onClick={() =>
                                registerCandidate.mutate({
                                  electionId: election.id,
                                  ...candidateForm,
                                })
                              }
                              disabled={
                                !candidateForm.partyId ||
                                !candidateForm.candidateName ||
                                registerCandidate.isPending
                              }
                              className="w-full"
                            >
                              Register Candidate
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Simulate Button */}
                      <Button
                        size="sm"
                        className="gap-1 bg-amber-600 hover:bg-amber-700"
                        disabled={election.candidates.length < 2 || simulateElection.isPending}
                        onClick={() => simulateElection.mutate({ electionId: election.id })}
                      >
                        <Play className="h-3 w-3" />
                        {simulateElection.isPending ? "Simulating..." : "Simulate"}
                      </Button>
                    </div>
                  </div>

                  {/* Registered Candidates */}
                  {election.candidates.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {election.candidates.map((c: any) => (
                        <div key={c.id} className="flex items-center gap-2 text-sm">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: c.party?.color ?? "#999" }}
                          />
                          <span>{c.candidateName}</span>
                          <span className="text-muted-foreground text-xs">({c.party?.name})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Past Elections */}
          {completedElections.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="text-muted-foreground text-sm font-medium">Past Elections</h4>
              {completedElections.map((election: any) => {
                const isExpanded = expandedElection === election.id;
                const sortedResults = [...(election.results || [])].sort(
                  (a: any, b: any) => b.seatsWon - a.seatsWon
                );
                const winner = sortedResults[0];

                return (
                  <div key={election.id} className="rounded-lg border p-3">
                    <button
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => setExpandedElection(isExpanded ? null : election.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <span className="font-medium">{election.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          Turnout: {election.turnout?.toFixed(1)}%
                        </Badge>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {/* Winner summary (always visible) */}
                    {winner && (
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: winner.candidate?.party?.color ?? "#999" }}
                        />
                        <span>
                          Winner: {winner.candidate?.party?.name} — {winner.seatsWon} seats (
                          {winner.votePercentage.toFixed(1)}%)
                        </span>
                      </div>
                    )}

                    {/* Expanded results */}
                    {isExpanded && (
                      <div className="mt-4 space-y-3">
                        {/* Results bar chart */}
                        <div className="space-y-2">
                          {sortedResults.map((r: any) => (
                            <div key={r.id} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: r.candidate?.party?.color ?? "#999" }}
                                  />
                                  {r.candidate?.party?.name ?? "Unknown"}
                                </span>
                                <span className="font-medium">
                                  {r.seatsWon} seats ({r.votePercentage.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="bg-muted h-2 w-full rounded-full">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${(r.seatsWon / (legislature?.totalSeats ?? 100)) * 100}%`,
                                    backgroundColor: r.candidate?.party?.color ?? "#999",
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Margin */}
                        {election.marginOfVictory != null && (
                          <div className="bg-muted/50 text-muted-foreground rounded p-2 text-center text-xs">
                            Margin of Victory: {election.marginOfVictory.toFixed(1)}%
                            {election.marginOfVictory < 2 && " — Very close!"}
                            {election.marginOfVictory < 5 &&
                              election.marginOfVictory >= 2 &&
                              " — Competitive"}
                            {election.marginOfVictory >= 15 && " — Decisive victory"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {pendingElections.length === 0 && completedElections.length === 0 && (
            <div className="text-muted-foreground py-6 text-center">
              <Vote className="mx-auto mb-3 h-8 w-8 opacity-50" />
              <p className="text-sm">No elections scheduled yet.</p>
              {!legislature && (
                <p className="mt-1 text-xs">
                  Configure a legislature first, then schedule elections.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Import for use in component
import { Landmark } from "lucide-react";
