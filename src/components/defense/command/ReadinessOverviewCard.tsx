// src/components/defense/command/ReadinessOverviewCard.tsx
"use client";

import React from "react";
import {
  Shield,
  Users,
  Target,
  Activity,
  HelpCircle,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

interface Branch {
  id: string;
  name: string;
  readinessLevel: number;
  technologyLevel: number;
  morale: number;
  annualBudget: number;
}

interface ReadinessOverviewCardProps {
  averageReadiness: number;
  averageTechnology: number;
  averageMorale: number;
  branches: Branch[] | undefined;
}

export const ReadinessOverviewCard = React.memo(
  function ReadinessOverviewCard({
    averageReadiness,
    averageTechnology,
    averageMorale,
    branches,
  }: ReadinessOverviewCardProps) {
    return (
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-red-600" />
            Strategic Readiness Overview
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <HelpCircle className="text-muted-foreground hover:text-primary h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-red-600" />
                    Strategic Readiness Metrics
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="mb-2 font-semibold">Overall Readiness</h4>
                    <p className="text-muted-foreground">
                      Measures the ability of your forces to deploy and conduct
                      operations immediately. Factors include equipment
                      availability, personnel training, and supply stockpiles.
                    </p>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">Technology Level</h4>
                    <p className="text-muted-foreground">
                      Reflects the sophistication of your military equipment and
                      systems. Higher technology levels provide tactical
                      advantages but require more maintenance and training.
                    </p>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">Force Morale</h4>
                    <p className="text-muted-foreground">
                      Indicates the motivation and esprit de corps of your
                      military personnel. High morale improves combat
                      effectiveness and reduces desertion rates.
                    </p>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">Improving Readiness</h4>
                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                      <li>
                        Increase operations & maintenance budget for better
                        equipment upkeep
                      </li>
                      <li>
                        Invest in training programs to improve personnel
                        competency
                      </li>
                      <li>
                        Modernize equipment through procurement to boost
                        technology levels
                      </li>
                      <li>
                        Maintain competitive salaries and benefits to sustain
                        morale
                      </li>
                      <li>
                        Conduct regular exercises to maintain operational
                        readiness
                      </li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>
            Aggregate readiness metrics across all branches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4" />
                Overall Readiness
              </div>
              <div className="text-3xl font-bold">
                <NumberFlowDisplay
                  value={averageReadiness}
                  format="percentage"
                  decimalPlaces={0}
                />
              </div>
              <Progress value={averageReadiness} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4" />
                Technology Level
              </div>
              <div className="text-3xl font-bold">
                <NumberFlowDisplay
                  value={averageTechnology}
                  format="percentage"
                  decimalPlaces={0}
                />
              </div>
              <Progress value={averageTechnology} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                Force Morale
              </div>
              <div className="text-3xl font-bold">
                <NumberFlowDisplay
                  value={averageMorale}
                  format="percentage"
                  decimalPlaces={0}
                />
              </div>
              <Progress value={averageMorale} className="h-2" />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Branch Summary */}
          {branches && branches.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold">Branch Status</h4>
              <div className="space-y-2">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="hover:bg-accent/50 flex items-center justify-between rounded-lg p-2"
                  >
                    <span className="text-sm">{branch.name}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground">
                        Readiness:{" "}
                        <span className="font-medium">
                          {branch.readinessLevel}%
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Budget:{" "}
                        <span className="font-medium">
                          ${(branch.annualBudget / 1000000).toFixed(0)}M
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);
