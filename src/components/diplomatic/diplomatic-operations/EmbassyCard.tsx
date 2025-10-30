/**
 * Embassy Card Component
 *
 * Displays detailed information about an embassy with expandable details
 * and action buttons.
 *
 * @module components/diplomatic/diplomatic-operations/EmbassyCard
 */

"use client";

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/lib/utils';
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
  MapPin
} from 'lucide-react';
import { getEmbassyStatusColor, getInfluenceColor } from '~/lib/diplomatic-operations-utils';

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
  onAllocateBudget
}: EmbassyCardProps) {
  // Memoize computed color value to prevent recalculation on every render
  const influenceColor = useMemo(
    () => getInfluenceColor(embassy.strength),
    [embassy.strength]
  );

  const statusColor = useMemo(
    () => getEmbassyStatusColor(embassy.status),
    [embassy.status]
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-surface glass-refraction rounded-lg overflow-hidden"
    >
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-lg">{embassy.country}</h3>
              <Badge className={cn('text-xs', statusColor)}>
                {embassy.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Influence</p>
                <div className="flex items-center gap-2">
                  <p className={cn('text-xl font-bold', influenceColor)}>{embassy.strength}%</p>
                  <Progress value={embassy.strength} className="h-2 flex-1" />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Level</p>
                <p className="text-xl font-bold text-purple-600">
                  {embassy.level || 1}
                </p>
              </div>
            </div>

            {embassy.role && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/50"
          >
            <div className="p-4 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">Staff</span>
                  </div>
                  <p className="text-lg font-bold">{embassy.staffCount || 10}/{embassy.maxStaff || 15}</p>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-muted-foreground">Budget</span>
                  </div>
                  <p className="text-lg font-bold">${((embassy.budget || 50000) / 1000).toFixed(0)}k</p>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                    <span className="text-xs text-muted-foreground">Missions</span>
                  </div>
                  <p className="text-lg font-bold">{embassy.currentMissions || 0}/{embassy.maxMissions || 2}</p>
                </div>

                <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <span className="text-xs text-muted-foreground">Security</span>
                  </div>
                  <p className="text-sm font-semibold capitalize">{embassy.securityLevel || 'Standard'}</p>
                </div>
              </div>

              {/* Ambassador Info */}
              {embassy.ambassadorName && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Ambassador</p>
                  <p className="font-semibold">{embassy.ambassadorName}</p>
                </div>
              )}

              {/* Services */}
              {embassy.services && embassy.services.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Services Offered</p>
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
                <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-800/40 bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Specialization</span>
                  </div>
                  <p className="text-sm font-semibold capitalize">{embassy.specialization}</p>
                  {embassy.specializationLevel && (
                    <Progress value={(embassy.specializationLevel / 3) * 100} className="h-1 mt-2" />
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                <Button
                  onClick={(e) => { e.stopPropagation(); onStartMission(); }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={(embassy.currentMissions || 0) >= (embassy.maxMissions || 2)}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Start Mission
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Upgrade
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); onAllocateBudget(); }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
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
