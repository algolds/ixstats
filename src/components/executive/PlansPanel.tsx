"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Target, Plus, TrendingUp, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { StrategicPlanningModal } from "~/components/modals/StrategicPlanningModal";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { api } from "~/trpc/react";

interface PlansPanelProps {
  countryId: string;
}

export function PlansPanel({ countryId }: PlansPanelProps) {
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);

  // Fetch country data
  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  // TODO: Connect to strategic planning API when available
  // For now, showing placeholder content

  return (
    <>
      {/* Strategic Planning Modal */}
      <StrategicPlanningModal
        isOpen={strategyModalOpen}
        onClose={() => setStrategyModalOpen(false)}
        countryId={countryId}
        countryName={country?.name || "Your Country"}
      />

      <div className="space-y-6">
        {/* Header Card */}
        <Card className="glass-hierarchy-child border-border">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Strategic Planning
                <SectionHelpIcon
                  title="Strategic Planning"
                  content="Develop and manage long-term strategic initiatives for your nation. Strategic plans guide major national projects, policy directions, and development goals over multiple years. Use this system to align your government's efforts toward key objectives and track progress on transformative initiatives."
                />
              </CardTitle>
              <CardDescription>
                Create and manage long-term strategic initiatives and projects
              </CardDescription>
            </div>
            <Button onClick={() => setStrategyModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Strategic Plan
            </Button>
          </CardHeader>
        </Card>

        {/* Planning Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="glass-hierarchy-child">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Active Plans</p>
                  <p className="mt-2 text-3xl font-bold">0</p>
                </div>
                <Target className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-hierarchy-child">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">In Progress</p>
                  <p className="mt-2 text-3xl font-bold">0</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-hierarchy-child">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Completed</p>
                  <p className="mt-2 text-3xl font-bold">0</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Strategic Planning Interface */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              Strategic Initiatives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
              <Target className="text-muted-foreground/70 h-12 w-12" />
              <div>
                <p className="font-medium">No strategic plans yet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Create your first strategic plan to guide long-term national development
                </p>
              </div>
              <Button onClick={() => setStrategyModalOpen(true)} className="gap-2 mt-2">
                <Plus className="h-4 w-4" />
                Create Strategic Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Strategic Recommendations */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Strategic Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Consider establishing 5-year development goals
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Strategic planning helps align policies and initiatives with long-term
                      national objectives
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/20">
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-900 dark:text-purple-100">
                      Strategic planning tools available
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Use the Strategic Planning Modal to set goals, define milestones, and track
                      progress on national development initiatives
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-900 dark:text-emerald-100">
                      Integrate with policy creation
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Link policies to strategic plans to ensure implementation aligns with your
                      national vision
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
