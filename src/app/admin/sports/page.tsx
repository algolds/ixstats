// src/app/admin/sports/page.tsx
// Admin sports management — canonical league oversight
"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { LeagueCreator } from "~/components/myleague/LeagueCreator";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useRouter } from "next/navigation";
import { Trophy, Plus, Trash2, Eye, Loader2, AlertTriangle, Shield } from "lucide-react";
import { useNotify } from "~/hooks/useNotify";
import { getAllPresets } from "~/lib/sports";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusMeta: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  draft: { label: "Draft", className: "bg-muted/50 text-muted-foreground border-border" },
  archived: { label: "Archived", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  suspended: { label: "Suspended", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const archetypeMeta: Record<string, { label: string; className: string }> = {
  league: { label: "League", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  division_conference: {
    label: "Division / Conference",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  bracket: { label: "Bracket", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  circuit: { label: "Circuit", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
};

function getSportIcon(sportPreset: string): string {
  const presets = getAllPresets();
  const preset = presets.find((p) => p.key === sportPreset);
  return preset?.icon ?? "\uD83C\uDFC6";
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function SportsAdminPage() {
  usePageTitle({ title: "Sports Admin" });
  const router = useRouter();
  const notify = useNotify();

  const [activeTab, setActiveTab] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const {
    data: leagues,
    isLoading,
    isError,
    refetch,
  } = api.sports.getLeagues.useQuery({}, { refetchOnWindowFocus: false });

  // ── Mutations ────────────────────────────────────────────────────────────
  const deleteMutation = api.sports.deleteLeague.useMutation({
    onSuccess: () => {
      notify.success("League Deleted", `${deleteTarget?.name ?? "League"} has been removed.`);
      setDeleteTarget(null);
      refetch();
    },
    onError: (error) => {
      notify.error("Delete Failed", error.message ?? "Could not delete league.");
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────
  const canonicalLeagues = useMemo(() => leagues?.filter((l) => l.isCanonical) ?? [], [leagues]);

  const handleDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate({ id: deleteTarget.id });
    }
  };

  const handleView = (id: string) => {
    router.push(withBasePath(`/sports/league/${id}`));
  };

  const handleManage = (id: string) => {
    router.push(withBasePath(`/admin/sports/league/${id}`));
  };

  // ── Shared table rendering ──────────────────────────────────────────────
  const renderTable = (leagueList: typeof leagues, showManageButton: boolean) => {
    if (isLoading) {
      return (
        <div className="space-y-3 py-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400" />
          <p className="text-muted-foreground text-sm">Failed to load leagues.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      );
    }

    if (!leagueList || leagueList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Trophy className="text-muted-foreground/40 h-10 w-10" />
          <p className="text-muted-foreground text-sm">No leagues found.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>League</TableHead>
            <TableHead>Sport</TableHead>
            <TableHead>Archetype</TableHead>
            <TableHead className="text-right">Teams</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Canonical</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leagueList.map((league) => {
            const status = statusMeta[league.status] ?? {
              label: league.status,
              className: "bg-muted/50 text-muted-foreground border-border",
            };
            const archetype = archetypeMeta[league.archetype] ?? {
              label: league.archetype,
              className: "bg-muted/50 text-muted-foreground border-border",
            };
            const icon = getSportIcon(league.sportPreset);

            return (
              <TableRow key={league.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="max-w-[180px] truncate">{league.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {league.sportPreset}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px]", archetype.className)}>
                    {archetype.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{league.teamCount}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px]", status.className)}>
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {league.isCanonical ? (
                    <Badge
                      variant="outline"
                      className="border-purple-500/30 bg-purple-500/10 text-[10px] text-purple-400"
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      Canonical
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleView(league.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {showManageButton && (
                      <Button variant="outline" size="sm" onClick={() => handleManage(league.id)}>
                        Manage
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => setDeleteTarget({ id: league.id, name: league.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  // ── Stats cards ──────────────────────────────────────────────────────────
  const totalLeagues = leagues?.length ?? 0;
  const totalCanonical = canonicalLeagues.length;
  const activeLeagues = leagues?.filter((l) => l.status === "active").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="facet-hierarchy-parent border-border/60 bg-card/40 rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="border-border/50 bg-muted/30 flex h-12 w-12 items-center justify-center rounded-xl border">
              <Trophy className="text-primary h-6 w-6" />
            </div>
            <div>
              <h1 className="text-foreground text-2xl font-bold">Sports Admin</h1>
              <p className="text-muted-foreground text-sm">Manage canonical leagues for MyLeague</p>
            </div>
          </div>
          <Button onClick={() => setCreatorOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Canonical
          </Button>
        </div>

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="facet-hierarchy-child border-border/50 bg-card/30 rounded-lg border p-3">
            <span className="text-muted-foreground text-[11px] font-medium uppercase">
              Total Leagues
            </span>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-12" />
            ) : (
              <div className="text-foreground mt-0.5 text-xl font-bold tabular-nums">
                {totalLeagues}
              </div>
            )}
          </div>
          <div className="facet-hierarchy-child rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
            <span className="text-muted-foreground text-[11px] font-medium uppercase">
              Canonical
            </span>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-12" />
            ) : (
              <div className="mt-0.5 text-xl font-bold text-purple-400 tabular-nums">
                {totalCanonical}
              </div>
            )}
          </div>
          <div className="facet-hierarchy-child rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <span className="text-muted-foreground text-[11px] font-medium uppercase">Active</span>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-12" />
            ) : (
              <div className="mt-0.5 text-xl font-bold text-emerald-400 tabular-nums">
                {activeLeagues}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 w-full justify-start">
          <TabsTrigger value="all">All Leagues</TabsTrigger>
          <TabsTrigger value="canonical">Canonical Leagues</TabsTrigger>
          <TabsTrigger value="create">Create Canonical</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card className="facet-hierarchy-child border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">All Leagues</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(leagues, false)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="canonical">
          <Card className="facet-hierarchy-child border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Canonical Leagues</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(canonicalLeagues, true)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card className="facet-hierarchy-child border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Create Canonical League</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
                  <Shield className="text-primary h-8 w-8" />
                </div>
                <div>
                  <p className="text-foreground font-medium">Create a Canonical League</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Canonical leagues are official and available to all nations.
                  </p>
                </div>
                <Button onClick={() => setCreatorOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Open League Creator
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* LeagueCreator dialog */}
      <LeagueCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        isCanonical
        onCreated={() => {
          refetch();
          setCreatorOpen(false);
        }}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete League</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="text-foreground font-semibold">{deleteTarget?.name}</span>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
