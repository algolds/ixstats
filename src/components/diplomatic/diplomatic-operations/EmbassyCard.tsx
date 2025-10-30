/**
 * Embassy Card Component
 *
 * Displays detailed information about an embassy with expandable details
 * and action buttons.
 *
 * @module components/diplomatic/diplomatic-operations/EmbassyCard
 */

"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils";
import {
  Building2,
  Users,
  DollarSign,
  Briefcase,
  Shield,
  Sparkles,
  Target,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";
import { getEmbassyStatusColor, getInfluenceColor } from "~/lib/diplomatic-operations-utils";

export interface EmbassyCardProps {
  embassy: any;
  isExpanded: boolean;
  onToggle: () => void;
  onUpgrade: () => void;
  onStartMission: () => void;
  onAllocateBudget: () => void;
}

/**
 * Embassy Card - Displays embassy information with expandable details
 */
export const EmbassyCard = React.memo(function EmbassyCard({
  embassy,
  isExpanded,
  onToggle,
  onUpgrade,
  onStartMission,
  onAllocateBudget,
}: EmbassyCardProps) {
  // Memoize computed color value to prevent recalculation on every render
  const influenceColor = useMemo(() => getInfluenceColor(embassy.strength), [embassy.strength]);

  const statusColor = useMemo(() => getEmbassyStatusColor(embassy.status), [embassy.status]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-surface glass-refraction overflow-hidden rounded-lg"
    >
      <div className="cursor-pointer p-4" onClick={onToggle}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">{embassy.country}</h3>
              <Badge className={cn("text-xs", statusColor)}>{embassy.status}</Badge>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground text-xs">Influence</p>
                <div className="flex items-center gap-2">
                  <p className={cn("text-xl font-bold", influenceColor)}>{embassy.strength}%</p>
                  <Progress value={embassy.strength} className="h-2 flex-1" />
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Level</p>
                <p className="text-xl font-bold text-purple-600">{embassy.level || 1}</p>
              </div>
            </div>

            {embassy.role && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                <span className="capitalize">{embassy.role}</span>
                {embassy.location && <span>• {embassy.location}</span>}
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-border/50 border-t"
          >
            <div className="space-y-4 p-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 p-3 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <div className="mb-1 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-muted-foreground text-xs">Staff</span>
                  </div>
                  <p className="text-lg font-bold">
                    {embassy.staffCount || 10}/{embassy.maxStaff || 15}
                  </p>
                </div>

                <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-3 dark:from-green-950/20 dark:to-emerald-950/20">
                  <div className="mb-1 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-muted-foreground text-xs">Budget</span>
                  </div>
                  <p className="text-lg font-bold">
                    ${((embassy.budget || 50000) / 1000).toFixed(0)}k
                  </p>
                </div>

                <div className="rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 p-3 dark:from-purple-950/20 dark:to-indigo-950/20">
                  <div className="mb-1 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                    <span className="text-muted-foreground text-xs">Missions</span>
                  </div>
                  <p className="text-lg font-bold">
                    {embassy.currentMissions || 0}/{embassy.maxMissions || 2}
                  </p>
                </div>

                <div className="rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 p-3 dark:from-amber-950/20 dark:to-yellow-950/20">
                  <div className="mb-1 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <span className="text-muted-foreground text-xs">Security</span>
                  </div>
                  <p className="text-sm font-semibold capitalize">
                    {embassy.securityLevel || "Standard"}
                  </p>
                </div>
              </div>

              {/* Ambassador Info */}
              {embassy.ambassadorName && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground mb-1 text-xs">Ambassador</p>
                  <p className="font-semibold">{embassy.ambassadorName}</p>
                </div>
              )}

              {/* Services */}
              {embassy.services && embassy.services.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs">Services Offered</p>
                  <div className="flex flex-wrap gap-2">
                    {embassy.services.map((service: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Specialization */}
              {embassy.specialization && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800/40 dark:bg-purple-950/20">
                  <div className="mb-1 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                      Specialization
                    </span>
                  </div>
                  <p className="text-sm font-semibold capitalize">{embassy.specialization}</p>
                  {embassy.specializationLevel && (
                    <Progress
                      value={(embassy.specializationLevel / 3) * 100}
                      className="mt-2 h-1"
                    />
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-1 gap-2 pt-2 md:grid-cols-3">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartMission();
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={(embassy.currentMissions || 0) >= (embassy.maxMissions || 2)}
                >
                  <Target className="mr-2 h-4 w-4" />
                  Start Mission
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpgrade();
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Upgrade
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAllocateBudget();
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Allocate Budget
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
