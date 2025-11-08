"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, HelpCircle } from "lucide-react";
import { api } from "~/trpc/react";

interface DiplomaticMissionsPanelProps {
  countryId: string;
}

export function DiplomaticMissionsPanel({ countryId }: DiplomaticMissionsPanelProps) {
  const [missionCreatorOpen, setMissionCreatorOpen] = useState(false);

  // TODO: Implement getActiveMissions endpoint in diplomatic router
  // For now, using empty array until embassy missions API is implemented
  const missions: any[] = [];
  const refetchMissions = () => Promise.resolve();

  // Categorize missions
  const { active, completed, cancelled } = useMemo(() => {
    return {
      active: missions
        .filter((m: any) => m.status === "IN_PROGRESS" || m.status === "PENDING")
        .sort((a: any, b: any) => new Date(b.startDate ?? b.createdAt).getTime() - new Date(a.startDate ?? a.createdAt).getTime()),
      completed: missions
        .filter((m: any) => m.status === "COMPLETED" || m.status === "SUCCESS")
        .sort((a: any, b: any) => new Date(b.completedDate ?? b.updatedAt).getTime() - new Date(a.completedDate ?? a.updatedAt).getTime()),
      cancelled: missions.filter((m: any) => m.status === "CANCELLED" || m.status === "FAILED"),
    };
  }, [missions]);

  const getStatusBadge = (mission: any) => {
    const status = mission.status?.toUpperCase() || "PENDING";

    if (status === "COMPLETED" || status === "SUCCESS") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20">
          <CheckCircle className="h-3 w-3" />
          COMPLETED
        </Badge>
      );
    }

    if (status === "CANCELLED" || status === "FAILED") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {status}
        </Badge>
      );
    }

    if (status === "IN_PROGRESS") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/20">
          <TrendingUp className="h-3 w-3" />
          IN PROGRESS
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        PENDING
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const MissionCard = ({ mission }: { mission: any }) => {
    return (
      <div className="border-border/40 bg-muted/40 rounded-lg border p-4 transition-all hover:shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-50 p-2 dark:bg-cyan-950/20">
              <Calendar className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <div className="text-foreground font-semibold">{mission.title || mission.name}</div>
              <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(mission.startDate ?? mission.createdAt)}
                </span>
                {mission.targetCountryName && (
                  <span>→ {mission.targetCountryName}</span>
                )}
              </div>
              {mission.description && (
                <p className="text-muted-foreground mt-2 text-sm">{mission.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge(mission)}
          </div>
        </div>

        {/* Mission Progress */}
        {mission.progress !== undefined && mission.status === "IN_PROGRESS" && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(mission.progress)}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-cyan-500 transition-all"
                style={{ width: `${mission.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button and Help */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Diplomatic Missions</h2>
          <p className="text-muted-foreground text-sm">Manage your ongoing diplomatic initiatives</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Diplomatic Missions - Help</DialogTitle>
                <DialogDescription>Understanding mission types, progress tracking, and success factors</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">🎯 Mission Types</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Trade Missions:</strong> Negotiate trade agreements and economic partnerships</p>
                    <p><strong>Cultural Exchange:</strong> Promote cultural understanding and cooperation</p>
                    <p><strong>Strategic Diplomacy:</strong> Build alliances and strengthen relationships</p>
                    <p><strong>Crisis Response:</strong> Address urgent diplomatic situations</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">📊 Progress Tracking</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Pending:</strong> Mission awaiting approval or start</p>
                    <p><strong>In Progress:</strong> Mission actively underway (shows progress bar)</p>
                    <p><strong>Completed:</strong> Mission successfully finished</p>
                    <p><strong>Failed/Cancelled:</strong> Mission did not complete</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">✅ Success Factors</h3>
                  <div className="space-y-2 text-sm">
                    <p>• Strong existing relationship with target country</p>
                    <p>• Sufficient diplomatic budget allocation</p>
                    <p>• Compatible cultural and political alignment</p>
                    <p>• Proper timing and strategic planning</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">💡 Tips</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>• Focus on countries where you have established embassies</p>
                    <p>• Monitor mission progress and adjust strategy as needed</p>
                    <p>• Completed missions often unlock new opportunities</p>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => setMissionCreatorOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Start Mission
          </Button>
        </div>
      </div>

      {/* Active Missions */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-600" />
            Active Missions ({active.length})
          </CardTitle>
          <CardDescription>Currently in progress</CardDescription>
        </CardHeader>
        <CardContent>
          {active.length > 0 ? (
            <div className="space-y-3">
              {active.map((mission: any) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              <Calendar className="text-muted-foreground/50 mx-auto mb-3 h-12 w-12" />
              <p className="text-sm">No active missions</p>
              <p className="text-muted-foreground/80 mt-1 text-xs">Start a diplomatic mission to strengthen relationships</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Missions */}
      {completed.length > 0 && (
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Completed Missions ({completed.length})
            </CardTitle>
            <CardDescription>Successfully completed initiatives</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completed.slice(0, 5).map((mission: any) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </div>
            {completed.length > 5 && (
              <Button variant="ghost" className="mt-4 w-full">
                View all {completed.length} completed missions
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
