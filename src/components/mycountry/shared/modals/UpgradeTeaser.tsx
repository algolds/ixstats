"use client";

import React from "react";
import { ArrowUp, Lock, Activity, Crown, StatsReport as BarChart3 } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import Link from "next/link";

/**
 * Premium upgrade banner + feature teaser cards shown beneath the tab content
 * for the "standard" variant of the MyCountry tab system.
 *
 * Extracted from MyCountryTabSystem during modular decomposition.
 * Behavior preserved exactly: renders nothing for the "premium" variant and
 * only renders content for the "standard" variant.
 */
export function UpgradeTeaser({
  variant = "unified",
}: {
  variant?: "unified" | "standard" | "premium";
}) {
  if (variant === "premium") return null;

  return (
    <>
      {/* Upgrade Banner for Standard */}
      {variant === "standard" && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-purple-200/30 bg-gradient-to-r from-purple-50/80 to-blue-50/80 p-3 dark:from-purple-950/30 dark:to-blue-950/30">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold">Unlock Premium Features</span>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              — Command Center, Intelligence, Analytics
            </span>
          </div>
          <Link href={"/mycountry/premium"}>
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              <ArrowUp className="h-3 w-3" />
              Upgrade
            </Button>
          </Link>
        </div>
      )}

      {/* Premium Features Teaser */}
      {variant === "standard" && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <Crown className="h-5 w-5 text-purple-500" />
                <Lock className="text-muted-foreground h-3.5 w-3.5" />
              </div>
              <CardTitle className="text-sm">Premium Command Center</CardTitle>
            </CardHeader>
            <CardContent className="relative pt-0">
              <div className="text-muted-foreground space-y-1 text-xs">
                <div>• Real-time crisis monitoring</div>
                <div>• Strategic decision recommendations</div>
                <div>• Premium briefings & alerts</div>
              </div>
              <Link href={"/mycountry/premium"} className="mt-3 block">
                <Button variant="outline" size="sm" className="w-full">
                  <ArrowUp className="mr-1.5 h-3 w-3" />
                  Upgrade
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <Activity className="h-5 w-5 text-blue-500" />
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    PREVIEW
                  </Badge>
                  <Lock className="text-muted-foreground h-3.5 w-3.5" />
                </div>
              </div>
              <CardTitle className="text-sm">Intelligence Briefings</CardTitle>
            </CardHeader>
            <CardContent className="relative pt-0">
              <div className="text-muted-foreground space-y-1 text-xs">
                <div>• National performance analysis</div>
                <div>• Forward-looking intelligence</div>
                <div>• Risk assessment & mitigation</div>
              </div>
              <Link href={"/mycountry/premium"} className="mt-3 block">
                <Button variant="outline" size="sm" className="w-full">
                  <ArrowUp className="mr-1.5 h-3 w-3" />
                  Upgrade
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <BarChart3 className="h-5 w-5 text-green-500" />
                <Lock className="text-muted-foreground h-3.5 w-3.5" />
              </div>
              <CardTitle className="text-sm">Advanced Analytics</CardTitle>
            </CardHeader>
            <CardContent className="relative pt-0">
              <div className="text-muted-foreground space-y-1 text-xs">
                <div>• Multi-year projections</div>
                <div>• Policy impact simulation</div>
                <div>• Comparative benchmarking</div>
              </div>
              <Link href={"/mycountry/premium"} className="mt-3 block">
                <Button variant="outline" size="sm" className="w-full">
                  <ArrowUp className="mr-1.5 h-3 w-3" />
                  Upgrade
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
