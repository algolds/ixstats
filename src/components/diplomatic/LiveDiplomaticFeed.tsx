"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { useCountryDiplomaticUpdates } from "~/hooks/useDiplomaticUpdates";
import type { LiveIntelligenceUpdate, DiplomaticEvent } from "~/lib/diplomatic-websocket";
import { IxTime } from "~/lib/ixtime";
import {
  RiWifiLine,
  RiWifiOffLine,
  RiNotification3Line,
  RiShakeHandsLine,
  RiGlobalLine,
  RiStarLine,
  RiAlarmWarningLine,
  RiFileTextLine,
  RiExchangeLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFilterLine,
  RiTimeLine,
  RiMapPinLine,
  RiArrowRightLine
} from "react-icons/ri";

interface LiveDiplomaticFeedProps {
  countryId: string;
  countryName: string;
  clearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  maxEvents?: number;
  autoRefresh?: boolean;
  showConnectionStatus?: boolean;
  compact?: boolean;
  className?: string;
}

const EVENT_ICONS = {
  embassy_established: RiShakeHandsLine,
  cultural_exchange_started: RiGlobalLine,
  achievement_unlocked: RiStarLine,
  diplomatic_crisis: RiAlarmWarningLine,
  trade_agreement: RiExchangeLine,
  intelligence_briefing: RiFileTextLine
} as const;

const EVENT_COLORS = {
  embassy_established: 'text-blue-400',
  cultural_exchange_started: 'text-purple-400',
  achievement_unlocked: 'text-yellow-400',
  diplomatic_crisis: 'text-red-400',
  trade_agreement: 'text-green-400',
  intelligence_briefing: 'text-[--intel-gold]'
} as const;

const PRIORITY_COLORS = {
  LOW: 'border-gray-500/30 bg-gray-500/10',
  NORMAL: 'border-blue-500/30 bg-blue-500/10',
  HIGH: 'border-orange-500/30 bg-orange-500/10',
  CRITICAL: 'border-red-500/30 bg-red-500/10'
} as const;

const LiveDiplomaticFeedComponent: React.FC<LiveDiplomaticFeedProps> = ({
  countryId,
  countryName,
  clearanceLevel = 'PUBLIC',
  maxEvents = 50,
  autoRefresh = true,
  showConnectionStatus = true,
  compact = false,
  className
}) => {
  const [state, actions] = useCountryDiplomaticUpdates(countryId, clearanceLevel, autoRefresh);
  const [showFilters, setShowFilters] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<DiplomaticEvent['type'] | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<DiplomaticEvent['priority'] | 'all'>('all');

  // Filter events based on criteria
  const filteredEvents = useMemo(() => {
    let filtered = state.recentEvents.slice(0, maxEvents);

    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(update => update.event.type === eventTypeFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(update => update.event.priority === priorityFilter);
    }

    return filtered;
  }, [state.recentEvents, maxEvents, eventTypeFilter, priorityFilter]);

  // Format relative time
  const formatRelativeTime = useCallback((timestamp: string) => {
    const now = new Date();
    const eventTime = new Date(timestamp);
    const diffMs = now.getTime() - eventTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }, []);

  // Render event item
  const renderEvent = (update: LiveIntelligenceUpdate, index: number) => {
    const { event } = update;
    const Icon = EVENT_ICONS[event.type] || RiNotification3Line;
    const colorClass = EVENT_COLORS[event.type] || 'text-white';
    const priorityClass = PRIORITY_COLORS[event.priority];

    return (
      <motion.div
        key={`${event.id}-${index}`}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={cn(
          "p-4 rounded-lg border transition-all hover:bg-white/5",
          priorityClass,
          compact ? "p-3" : "p-4"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Event Icon */}
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            `bg-${colorClass.replace('text-', '').replace('-400', '-500')}/20`
          )}>
            <Icon className={cn("w-4 h-4", colorClass)} />
          </div>

          {/* Event Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className={cn(
                "font-medium text-white",
                compact ? "text-sm" : "text-base"
              )}>
                {getEventTitle(event)}
              </h4>
              
              {/* Priority Badge */}
              {event.priority !== 'NORMAL' && (
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  event.priority === 'CRITICAL' ? "bg-red-500/20 text-red-400" :
                  event.priority === 'HIGH' ? "bg-orange-500/20 text-orange-400" :
                  "bg-gray-500/20 text-gray-400"
                )}>
                  {event.priority}
                </span>
              )}
            </div>

            <p className={cn(
              "text-[--intel-silver] mb-2",
              compact ? "text-xs" : "text-sm"
            )}>
              {getEventDescription(event)}
            </p>

            {/* Event Metadata */}
            <div className="flex items-center gap-4 text-xs text-[--intel-silver]">
              <div className="flex items-center gap-1">
                <RiTimeLine className="w-3 h-3" />
                <span>{formatRelativeTime(event.timestamp)}</span>
              </div>
              
              {event.targetCountryName && (
                <div className="flex items-center gap-1">
                  <RiArrowRightLine className="w-3 h-3" />
                  <span>{event.targetCountryName}</span>
                </div>
              )}

              {/* Classification Badge */}
              <span className={cn(
                "px-2 py-1 rounded-full text-xs font-medium",
                event.classification === 'CONFIDENTIAL' ? "bg-red-500/20 text-red-300" :
                event.classification === 'RESTRICTED' ? "bg-orange-500/20 text-orange-300" :
                "bg-green-500/20 text-green-300"
              )}>
                {event.classification}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Get event title based on type
  const getEventTitle = (event: DiplomaticEvent): string => {
    switch (event.type) {
      case 'embassy_established':
        return `Embassy established with ${event.targetCountryName || 'Unknown Country'}`;
      case 'cultural_exchange_started':
        return `Cultural exchange program launched`;
      case 'achievement_unlocked':
        return `New diplomatic achievement unlocked`;
      case 'diplomatic_crisis':
        return `Diplomatic crisis detected`;
      case 'trade_agreement':
        return `Trade agreement signed`;
      case 'intelligence_briefing':
        return `Intelligence briefing updated`;
      default:
        return 'Diplomatic event';
    }
  };

  // Get event description
  const getEventDescription = (event: DiplomaticEvent): string => {
    const baseDesc = `${event.countryName} `;
    
    switch (event.type) {
      case 'embassy_established':
        return `${baseDesc}established diplomatic relations with ${event.targetCountryName}`;
      case 'cultural_exchange_started':
        return `${baseDesc}launched a new cultural exchange program`;
      case 'achievement_unlocked':
        return `${baseDesc}unlocked a new diplomatic achievement`;
      case 'diplomatic_crisis':
        return `${baseDesc}is experiencing diplomatic tensions`;
      case 'trade_agreement':
        return `${baseDesc}signed a new trade agreement`;
      case 'intelligence_briefing':
        return `${baseDesc}intelligence briefing has been updated`;
      default:
        return `${baseDesc}diplomatic activity detected`;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className={cn(
            "font-bold text-[--intel-gold] flex items-center gap-2",
            compact ? "text-lg" : "text-xl"
          )}>
            <RiNotification3Line className={compact ? "w-5 h-5" : "w-6 h-6"} />
            Live Intelligence Feed
          </h3>
          
          {/* Connection Status */}
          {showConnectionStatus && (
            <div className="flex items-center gap-2">
              {state.isConnected ? (
                <>
                  <RiWifiLine className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">Connected</span>
                </>
              ) : (
                <>
                  <RiWifiOffLine className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400">
                    {state.status === 'connecting' ? 'Connecting...' : 'Disconnected'}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Event Count Badge */}
          {state.eventCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-red-500 text-white text-xs rounded-full px-2 py-1 font-bold"
            >
              {state.eventCount}
            </motion.div>
          )}

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showFilters 
                ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                : "text-[--intel-silver] hover:text-white hover:bg-white/10"
            )}
          >
            <RiFilterLine className="w-4 h-4" />
          </button>

          {/* Clear Events */}
          <button
            onClick={actions.clearEvents}
            className="p-2 text-[--intel-silver] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <RiEyeOffLine className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-[--intel-gold]/20"
          >
            <div className="flex items-center gap-2">
              <label className="text-sm text-[--intel-silver]">Type:</label>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-[--intel-gold]/50"
              >
                <option value="all">All Types</option>
                <option value="embassy_established">Embassy</option>
                <option value="cultural_exchange_started">Cultural</option>
                <option value="achievement_unlocked">Achievements</option>
                <option value="diplomatic_crisis">Crisis</option>
                <option value="trade_agreement">Trade</option>
                <option value="intelligence_briefing">Intelligence</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-[--intel-silver]">Priority:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-[--intel-gold]/50"
              >
                <option value="all">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Feed */}
      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-track-white/10 scrollbar-thumb-[--intel-gold]/30">
        <AnimatePresence mode="popLayout">
          {filteredEvents.length > 0 ? (
            filteredEvents.map(renderEvent)
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-[--intel-silver]"
            >
              <RiNotification3Line className="w-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No diplomatic events to display</p>
              {!state.isConnected && (
                <p className="text-xs mt-2">
                  Connect to receive live updates
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Connection Status Messages */}
      {state.connectionError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-lg border text-sm",
            state.connectionError.includes('Offline mode') || state.connectionError.includes('not configured')
              ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
              : "bg-red-500/20 border-red-500/30 text-red-400"
          )}
        >
          <div className="flex items-start gap-3">
            <RiAlarmWarningLine className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium mb-1">
                {state.connectionError.includes('Offline mode') ? 'Offline Mode' : 
                 state.connectionError.includes('not configured') ? 'Configuration Notice' :
                 'Connection Error'}
              </div>
              <div className="text-xs opacity-90">
                {state.connectionError}
              </div>
              {state.connectionError.includes('Offline mode') && (
                <div className="text-xs mt-2 opacity-75">
                  Real-time updates are disabled. The system will continue to work with static data.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Offline Mode Notice */}
      {!state.isConnected && !state.connectionError && state.status === 'disconnected' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm"
        >
          <div className="flex items-center gap-2">
            <RiWifiOffLine className="w-4 h-4" />
            <span>Real-time updates disconnected. Operating in offline mode.</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

LiveDiplomaticFeedComponent.displayName = 'LiveDiplomaticFeed';

export const LiveDiplomaticFeed = React.memo(LiveDiplomaticFeedComponent);