"use client";

import { useState } from "react";
import {
  FlaskConical,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Database,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";

export function DemoModeAdmin() {
  const [sourceCountryId, setSourceCountryId] = useState("");
  const [destroyDialogOpen, setDestroyDialogOpen] = useState(false);
  const utils = api.useUtils();

  // Queries
  const { data: status, isLoading: statusLoading } = api.demoMode.getStatus.useQuery();
  const { data: countries } = api.countries.getSelectList.useQuery();

  // Mutations
  const activateMutation = api.demoMode.activate.useMutation({
    onSuccess: () => {
      void utils.demoMode.invalidate();
    },
  });
  const deactivateMutation = api.demoMode.deactivate.useMutation({
    onSuccess: () => {
      void utils.demoMode.invalidate();
    },
  });
  const reactivateMutation = api.demoMode.reactivate.useMutation({
    onSuccess: () => {
      void utils.demoMode.invalidate();
    },
  });
  const reseedMutation = api.demoMode.reseed.useMutation({
    onSuccess: () => {
      void utils.demoMode.invalidate();
    },
  });
  const destroyMutation = api.demoMode.destroy.useMutation({
    onSuccess: () => {
      void utils.demoMode.invalidate();
    },
  });

  const isAnyMutationLoading =
    activateMutation.isPending ||
    deactivateMutation.isPending ||
    reactivateMutation.isPending ||
    reseedMutation.isPending ||
    destroyMutation.isPending;

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  const hasDemo = !!status?.demoCountryId;
  const isActive = !!status?.isActive;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-2.5">
          <FlaskConical className="h-6 w-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Demo Mode Management</h2>
          <p className="text-muted-foreground text-sm">
            Create and manage a demo country with seeded data for live demonstrations.
          </p>
        </div>
      </div>

      {/* Status Card */}
      <div className="border-border/50 bg-card rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${isActive ? "animate-pulse bg-green-500" : hasDemo ? "bg-amber-500" : "bg-gray-500"}`}
            />
            <div>
              <span className="font-semibold">
                {isActive ? "Demo Mode Active" : hasDemo ? "Demo Mode Inactive" : "No Demo Country"}
              </span>
              {status?.demoCountryName && (
                <p className="text-muted-foreground text-sm">{status.demoCountryName}</p>
              )}
            </div>
          </div>
          <Badge
            variant={isActive ? "default" : "secondary"}
            className={isActive ? "bg-green-600" : ""}
          >
            {isActive ? "ACTIVE" : hasDemo ? "PAUSED" : "OFF"}
          </Badge>
        </div>

        {status?.createdAt && (
          <p className="text-muted-foreground mt-2 text-xs">
            Created: {new Date(status.createdAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Seed Stats */}
      {status?.seedStats && (
        <div className="border-border/50 bg-card rounded-xl border p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Database className="h-4 w-4" />
            Seeded Data Statistics
          </h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {Object.entries(status.seedStats)
              .filter(([key]) => key !== "total")
              .map(([key, value]) => (
                <div
                  key={key}
                  className="border-border/30 bg-muted/30 rounded-lg border p-3 text-center"
                >
                  <div className="text-lg font-bold">{value as number}</div>
                  <div className="text-muted-foreground text-xs capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </div>
                </div>
              ))}
          </div>
          <div className="text-muted-foreground mt-3 text-right text-sm">
            Total records: <span className="font-semibold">{status.seedStats.total}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-border/50 bg-card rounded-xl border p-6">
        <h3 className="mb-4 font-semibold">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {/* Activate: only show when no demo exists */}
          {!hasDemo && (
            <div className="flex items-center gap-2">
              <select
                value={sourceCountryId}
                onChange={(e) => setSourceCountryId(e.target.value)}
                className="border-border bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Select source country...</option>
                {countries?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => activateMutation.mutate({ sourceCountryId })}
                disabled={!sourceCountryId || isAnyMutationLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {activateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Power className="mr-2 h-4 w-4" />
                )}
                Activate Demo
              </Button>
            </div>
          )}

          {/* Toggle active/inactive */}
          {hasDemo && isActive && (
            <Button
              variant="outline"
              onClick={() => deactivateMutation.mutate()}
              disabled={isAnyMutationLoading}
            >
              {deactivateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PowerOff className="mr-2 h-4 w-4" />
              )}
              Deactivate
            </Button>
          )}
          {hasDemo && !isActive && (
            <Button
              onClick={() => reactivateMutation.mutate()}
              disabled={isAnyMutationLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {reactivateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Power className="mr-2 h-4 w-4" />
              )}
              Reactivate
            </Button>
          )}

          {/* Re-seed */}
          {hasDemo && (
            <Button
              variant="outline"
              onClick={() => reseedMutation.mutate()}
              disabled={isAnyMutationLoading}
            >
              {reseedMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Re-seed Data
            </Button>
          )}

          {/* Destroy */}
          {hasDemo && (
            <>
              <Button
                variant="destructive"
                disabled={isAnyMutationLoading}
                onClick={() => setDestroyDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Destroy Demo
              </Button>
              <AlertDialog open={destroyDialogOpen} onOpenChange={setDestroyDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Destroy Demo Country?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the demo country and ALL seeded data. You&apos;ll
                      need to re-activate to create a new demo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogClose>Cancel</AlertDialogClose>
                    <AlertDialogClose
                      className="bg-red-600 text-white hover:bg-red-700"
                      onClick={() => destroyMutation.mutate()}
                    >
                      {destroyMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Destroy
                    </AlertDialogClose>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        {/* Mutation feedback */}
        {activateMutation.isSuccess && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-500">
            <CheckCircle2 className="h-4 w-4" />
            Demo country created and seeded successfully!
          </div>
        )}
        {reseedMutation.isSuccess && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-500">
            <CheckCircle2 className="h-4 w-4" />
            Demo data re-seeded successfully!
          </div>
        )}
        {(activateMutation.isError || reseedMutation.isError || destroyMutation.isError) && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-500">
            <AlertTriangle className="h-4 w-4" />
            {activateMutation.error?.message ||
              reseedMutation.error?.message ||
              destroyMutation.error?.message}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="border-border/50 bg-card rounded-xl border p-6">
        <h3 className="mb-3 font-semibold">How Demo Mode Works</h3>
        <ul className="text-muted-foreground space-y-2 text-sm">
          <li>
            1. Select a source country and click "Activate Demo" to create a cloned demo country.
          </li>
          <li>
            2. The demo country is seeded with realistic data across all MyCountry subsystems.
          </li>
          <li>
            3. When active, system owners see the demo country instead of their real one in
            MyCountry.
          </li>
          <li>4. A purple "DEMO MODE" banner appears at the top to indicate demo state.</li>
          <li>5. Deactivate to return to your real country. Re-seed to refresh demo data.</li>
          <li>6. Demo countries are hidden from public country listings and leaderboards.</li>
        </ul>
      </div>
    </div>
  );
}
