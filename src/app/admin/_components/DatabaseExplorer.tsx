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
      <Card className="bg-card/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  PostgreSQL & PostGIS Database
                </CardTitle>
                <CardDescription className="text-xs">
                  Production schema with 296 models across 15 domain definitions
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-400"
            >
              <CheckCircle className="mr-1 h-3.5 w-3.5" />
              Connected (Port 5433)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-background/30 rounded-lg border border-white/5 p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Server className="h-4 w-4" />
                <span>Registered Nations</span>
              </div>
              <p className="text-foreground mt-2 text-2xl font-bold">
                {isLoading ? "..." : (globalStats?.totalNations ?? 0)}
              </p>
            </div>
            <div className="bg-background/30 rounded-lg border border-white/5 p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <HardDrive className="h-4 w-4" />
                <span>Active Conflict Records</span>
              </div>
              <p className="text-foreground mt-2 text-2xl font-bold">
                {isLoading ? "..." : (globalStats?.activeConflicts ?? 0)}
              </p>
            </div>
            <div className="bg-background/30 rounded-lg border border-white/5 p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Database className="h-4 w-4" />
                <span>Global GDP Aggregate</span>
              </div>
              <p className="text-foreground mt-2 text-2xl font-bold">
                {isLoading ? "..." : `$${(globalStats?.globalGDP ?? 0).toFixed(2)}T`}
              </p>
            </div>
          </div>

          <div className="bg-background/20 text-muted-foreground rounded-lg border border-white/5 p-4 text-xs">
            <p className="text-foreground mb-1 font-medium">Prisma Studio GUI Management</p>
            <p>
              Direct full-table CRUD operations and database exploration are served securely via
              Prisma Studio. Launch Prisma Studio in your terminal using:
            </p>
            <code className="bg-background/80 mt-2 inline-block rounded px-2 py-1 font-mono text-emerald-400">
              bun run db:studio
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
