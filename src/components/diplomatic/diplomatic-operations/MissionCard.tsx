/**
 * Mission Card Component
 *
 * Displays detailed information about a diplomatic mission.
 *
 * @module components/diplomatic/diplomatic-operations/MissionCard
 */

"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Star,
  TrendingUp,
  Award,
  DollarSign,
  Clock,
} from "lucide-react";
import { getMissionStatusColor, getDifficultyColor } from "~/lib/diplomatic-operations-utils";

export interface MissionCardProps {
  mission: any;
  onComplete?: () => void;
}

/**
 * Mission Card - Displays mission information with progress and rewards
 */
export const MissionCard = React.memo(function MissionCard({
  mission,
  onComplete,
}: MissionCardProps) {
  const statusIcons: Record<string, React.ReactNode> = {
    active: <Activity className="h-4 w-4 text-blue-600" />,
    completed: <CheckCircle className="h-4 w-4 text-green-600" />,
    failed: <XCircle className="h-4 w-4 text-red-600" />,
    cancelled: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
  };

  const statusColor = useMemo(() => getMissionStatusColor(mission.status), [mission.status]);

  const difficultyColor = useMemo(
    () => getDifficultyColor(mission.difficulty),
    [mission.difficulty]
  );

  // Memoize status calculations to prevent recalculation on every render
  const isActive = useMemo(() => mission.status === "active", [mission.status]);
  const canComplete = useMemo(
    () => isActive && mission.progress >= 100,
    [isActive, mission.progress]
  );

  return (
    <Card className="glass-surface glass-refraction transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              {statusIcons[mission.status] || statusIcons.active}
              <CardTitle className="text-base">{mission.name}</CardTitle>
            </div>
            <CardDescription className="text-sm">{mission.description}</CardDescription>
          </div>
          <Badge className={cn("text-xs", statusColor)}>{mission.status}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Mission Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Type</p>
            <p className="font-semibold capitalize">{mission.type.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Difficulty</p>
            <p className={cn("font-semibold capitalize", difficultyColor)}>{mission.difficulty}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Staff Assigned</p>
            <p className="font-semibold">{mission.requiredStaff}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Success Rate</p>
            <p className="font-semibold text-green-600">{mission.successChance}%</p>
          </div>
        </div>

        {/* Progress Bar (for active missions) */}
        {isActive && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-muted-foreground text-xs">Progress</p>
              <p className="text-xs font-semibold">{Math.round(mission.progress || 0)}%</p>
            </div>
            <Progress value={mission.progress || 0} className="h-2" />
          </div>
        )}

        {/* Time Remaining */}
        {isActive && mission.completesAt && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground">
              Completes: {new Date(mission.completesAt).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Rewards */}
        <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 p-3 dark:from-purple-950/20 dark:to-indigo-950/20">
          <p className="text-muted-foreground mb-2 text-xs">Rewards</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-600" />
              <span>+{mission.experienceReward} XP</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-blue-600" />
              <span>+{mission.influenceReward} Influence</span>
            </div>
            <div className="flex items-center gap-1">
              <Award className="h-3 w-3 text-purple-600" />
              <span>+{mission.reputationReward} Rep</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-green-600" />
              <span>${(mission.economicReward || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Complete Button */}
        {canComplete && onComplete && (
          <Button onClick={onComplete} className="w-full" size="sm">
            <CheckCircle className="mr-2 h-4 w-4" />
            Complete Mission
          </Button>
        )}
      </CardContent>
    </Card>
  );
});
