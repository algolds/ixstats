"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
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

      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-semibold">Strategic Planning</h3>
            <SectionHelpIcon
              title="Strategic Planning"
              content="Develop and manage long-term strategic initiatives for your nation. Strategic plans guide major national projects, policy directions, and development goals over multiple years. Use this system to align your government's efforts toward key objectives and track progress on transformative initiatives."
            />
          </div>
          <Button size="sm" onClick={() => setStrategyModalOpen(true)} className="gap-1.5">
            <Plus className="h-3 w-3" />
            New Plan
          </Button>
        </div>

        {/* Planning Stats Strip */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="glass-hierarchy-child rounded-lg bg-purple-50 p-2.5 dark:bg-purple-950/20">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 flex-shrink-0 text-purple-600" />
              <span className="text-muted-foreground text-xs font-medium">Active Plans</span>
            </div>
            <div className="mt-0.5 text-lg font-bold">0</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg bg-yellow-50 p-2.5 dark:bg-yellow-950/20">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 flex-shrink-0 text-yellow-600" />
              <span className="text-muted-foreground text-xs font-medium">In Progress</span>
            </div>
            <div className="mt-0.5 text-lg font-bold">0</div>
          </div>
          <div className="glass-hierarchy-child rounded-lg bg-green-50 p-2.5 dark:bg-green-950/20">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
              <span className="text-muted-foreground text-xs font-medium">Completed</span>
            </div>
            <div className="mt-0.5 text-lg font-bold">0</div>
          </div>
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
            <div className="border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <Target className="text-muted-foreground/70 h-8 w-8" />
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
