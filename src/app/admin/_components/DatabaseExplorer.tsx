"use client";
// src/app/admin/_components/DatabaseExplorer.tsx

import React from "react";
import { Database, CheckCircle, Server, HardDrive } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

export function DatabaseExplorer() {
  const { data: globalStats, isLoading } = api.admin.getGlobalStats.useQuery();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-control bg-green/10 text-green p-2.5">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-headline">PostgreSQL & PostGIS Database</CardTitle>
                <CardDescription className="text-footnote">
                  Production schema with 296 models across 15 domain definitions
                </CardDescription>
              </div>
            </div>
            <Badge variant="green">
              <CheckCircle className="mr-1 h-3.5 w-3.5" />
              Connected (Port 5433)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-fill-3 rounded-control border-separator border p-4">
              <div className="text-label-secondary text-footnote flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span>Registered Nations</span>
              </div>
              <p className="text-label text-title-1 mt-2">
                {isLoading ? "..." : (globalStats?.totalNations ?? 0)}
              </p>
            </div>
            <div className="bg-fill-3 rounded-control border-separator border p-4">
              <div className="text-label-secondary text-footnote flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span>Active Conflict Records</span>
              </div>
              <p className="text-label text-title-1 mt-2">
                {isLoading ? "..." : (globalStats?.activeConflicts ?? 0)}
              </p>
            </div>
            <div className="bg-fill-3 rounded-control border-separator border p-4">
              <div className="text-label-secondary text-footnote flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Global GDP Aggregate</span>
              </div>
              <p className="text-label text-title-1 mt-2">
                {isLoading ? "..." : `$${(globalStats?.globalGDP ?? 0).toFixed(2)}T`}
              </p>
            </div>
          </div>

          <div className="bg-fill-3 text-label-secondary rounded-control border-separator text-footnote border p-4">
            <p className="text-label mb-1 font-medium">Prisma Studio GUI Management</p>
            <p>
              Direct full-table CRUD operations and database exploration are served securely via
              Prisma Studio. Launch Prisma Studio in your terminal using:
            </p>
            <code className="bg-background rounded-control-sm text-green mt-2 inline-block px-2 py-1 tabular-nums">
              bun run db:studio
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
