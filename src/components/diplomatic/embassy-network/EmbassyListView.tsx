/**
 * @file EmbassyListView.tsx
 * @description A component to display a list of diplomatic relations with an intel-themed design.
 * It supports selection, animation, and an empty state with an action.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import type { DiplomaticRelation } from "~/types/diplomatic-network";
import {
  RiShakeHandsLine,
  RiGlobalLine,
  RiEyeLine,
  RiShieldLine,
  RiSearchLine,
  RiBuildingLine
} from "react-icons/ri";

// Relation type configurations for styling and icons
const RELATION_TYPES = {
  alliance: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/40',
    icon: RiShakeHandsLine,
    label: 'Alliance',
  },
  trade: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/40',
    icon: RiGlobalLine,
    label: 'Trade Partner',
  },
  neutral: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/40',
    icon: RiEyeLine,
    label: 'Neutral',
  },
  tension: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/40',
    icon: RiShieldLine,
    label: 'Tension',
  }
} as const;

/**
 * Props for the EmbassyListView component.
 */
interface EmbassyListViewProps {
  /** The relations to display, already filtered and sorted. */
  filteredRelations: DiplomaticRelation[];
  /** The currently selected relation for highlighting. */
  selectedRelation: DiplomaticRelation | null;
  /** Callback when a relation item is clicked. */
  onRelationClick: (relation: DiplomaticRelation) => void;
  /** Optional callback to trigger establishing a new embassy. */
  onEstablishEmbassy?: () => void;
  /** The clearance level of the viewer, to control actions. */
  viewerClearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
}

/**
 * `EmbassyListView` is a memoized component that renders a list of diplomatic relations.
 * It features framer-motion animations for list items and a styled empty state.
 */
const EmbassyListViewComponent: React.FC<EmbassyListViewProps> = ({
  filteredRelations,
  selectedRelation,
  onRelationClick,
  onEstablishEmbassy,
  viewerClearanceLevel = 'PUBLIC'
}) => {
  return (
    <div className="space-y-3">
      <AnimatePresence>
        {filteredRelations.length > 0 ? (
          filteredRelations.map((relation, index) => {
            const typeConfig = RELATION_TYPES[relation.relationType];
            const Icon = typeConfig.icon || RiGlobalLine;

            return (
              <motion.div
                key={relation.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                onClick={() => onRelationClick(relation)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer",
                  "bg-white/5 hover:bg-white/10 border-white/10 hover:border-[--intel-gold]/30",
                  selectedRelation?.id === relation.id && "border-[--intel-gold]/50 bg-[--intel-gold]/10"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    typeConfig.bgColor, "border", typeConfig.borderColor
                  )}>
                    <Icon className={cn("h-5 w-5", typeConfig.color)} />
                  </div>

                  <div>
                    <div className="font-semibold text-foreground">{relation.countryName}</div>
                    <div className="flex items-center gap-3 text-sm text-[--intel-silver]">
                      <span className={cn("capitalize", typeConfig.color)}>
                        {typeConfig.label}
                      </span>
                      <span>•</span>
                      <span>Strength: {relation.strength || 0}%</span>
                      {relation.economicTier && (
                        <>
                          <span>•</span>
                          <span>{relation.economicTier}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[--intel-silver] text-sm">
                    Est. {new Date(relation.establishedAt).getFullYear()}
                  </div>
                  {relation.recentActivity && (
                    <div className="text-[--intel-amber] text-xs mt-1">
                      Recent Activity
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center py-12 text-[--intel-silver]">
              <RiSearchLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No diplomatic relations found</p>
              <p className="text-sm mb-4">Try adjusting your search or filter criteria</p>
              {viewerClearanceLevel !== 'PUBLIC' && onEstablishEmbassy && (
                <button
                  onClick={onEstablishEmbassy}
                  className="inline-flex items-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <RiBuildingLine className="h-4 w-4" />
                  Establish Embassy
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const EmbassyListView = React.memo(EmbassyListViewComponent);
