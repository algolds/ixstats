// src/app/admin/_components/DatabaseExplorer.tsx
"use client";

import React from "react";
import { Database, CheckCircle, Server, HardDrive } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

export function DatabaseExplorer() {
  const { data: globalStats, isLoading } = api.admin.getGlobalStats.useQuery();

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-card/40 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">PostgreSQL & PostGIS Database</CardTitle>
                <CardDescription className="text-xs">
                  Production schema with 296 models across 15 domain definitions
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
              <CheckCircle className="mr-1 h-3.5 w-3.5" />
              Connected (Port 5433)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-white/5 bg-background/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Server className="h-4 w-4" />
                <span>Registered Nations</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {isLoading ? "..." : globalStats?.totalNations ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-background/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <HardDrive className="h-4 w-4" />
                <span>Active Conflict Records</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {isLoading ? "..." : globalStats?.activeConflicts ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-white/5 bg-background/30 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Database className="h-4 w-4" />
                <span>Global GDP Aggregate</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {isLoading ? "..." : `$${(globalStats?.globalGDP ?? 0).toFixed(2)}T`}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/5 bg-background/20 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Prisma Studio GUI Management</p>
            <p>
              Direct full-table CRUD operations and database exploration are served securely via Prisma Studio.
              Launch Prisma Studio in your terminal using:
            </p>
            <code className="mt-2 inline-block rounded bg-background/80 px-2 py-1 font-mono text-emerald-400">
              bun run db:studio
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
