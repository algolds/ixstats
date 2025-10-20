"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Crown,
  Factory,
  Globe,
  Calendar,
  ShieldAlert,
  Building2,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

interface LiveEventsFeedProps {
  countryId: string;
  onEventClick?: (eventId: string) => void;
}

export function LiveEventsFeed({ countryId, onEventClick }: LiveEventsFeedProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: liveFeed, isLoading } = api.countries.getLiveEventsFeed.useQuery(
    { countryId, limit: 12, hours: 96 },
    { refetchInterval: 30000, staleTime: 15000 }
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'economic_growth':
      case 'population_growth':
        return TrendingUp;
      case 'economic_decline':
        return TrendingDown;
      case 'crisis':
        return AlertTriangle;
      case 'diplomatic':
        return Globe;
      case 'industrial':
        return Factory;
      case 'government':
        return Crown;
      case 'cabinet_meeting':
        return Calendar;
      case 'embassy_mission':
        return Building2;
      case 'security':
        return ShieldAlert;
      default:
        return Zap;
    }
  };

  const getEventColor = (type: string, severity?: string) => {
    switch (type) {
      case 'economic_growth': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'economic_decline': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'crisis': 
        switch (severity) {
          case 'high': return 'text-red-400 bg-red-500/20 border-red-500/30';
          case 'medium': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
          default: return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
        }
      case 'diplomatic': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'embassy_mission': return 'text-purple-300 bg-purple-500/20 border-purple-500/30';
      case 'cabinet_meeting': return 'text-sky-300 bg-sky-500/20 border-sky-500/30';
      case 'security':
        if (severity && ['critical', 'existential'].includes(severity.toLowerCase())) {
          return 'text-red-300 bg-red-600/20 border-red-600/40';
        }
        return 'text-amber-300 bg-amber-500/20 border-amber-500/30';
      case 'industrial': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const formatTimeAgo = (timestamp: string | Date) => {
    const now = currentTime.getTime();
    const eventTime = new Date(timestamp).getTime();
    const diffMs = now - eventTime;
    const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    if (Math.abs(diffMinutes) < 1) return 'Just now';

    if (diffMs >= 0) {
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } else {
      if (diffMinutes < 60) return `in ${diffMinutes}m`;
      if (diffHours < 24) return `in ${diffHours}h`;
      return `in ${Math.floor(diffHours / 24)}d`;
    }
  };
  const allEvents = liveFeed?.events ?? [];

  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="text-cyan-400 flex items-center gap-2">
          <Zap className="h-5 w-5" />
           Events Feed
        </CardTitle>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Real-time diplomatic events
          </p>
        
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
              <p className="text-sm">Loading recent activity…</p>
            </div>
          ) : allEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No recent events</p>
              <p className="text-xs">Events will appear as they occur</p>
            </div>
          ) : (
            allEvents.map((event, index) => {
              const Icon = getEventIcon(event.type);
              const colorClasses = getEventColor(event.type, event.severity ?? undefined);

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all hover:scale-105",
                    colorClasses
                  )}
                  onClick={() => onEventClick?.(event.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 p-2 rounded-lg bg-white/10">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm truncate">{event.title}</h4>
                        <div className="flex items-center gap-2">
                          {event.severity && (
                            <Badge variant="outline" className="text-xs">
                              {event.severity.toUpperCase()}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimeAgo(event.timestamp)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                      {(() => {
                        const metadata = (event.metadata ?? {}) as Record<string, any>;
                        const hasMetadata = Object.keys(metadata).length > 0;
                        if (!(event.tags?.length || hasMetadata)) {
                          return null;
                        }

                        return (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {event.tags?.map((tag) => (
                              <span key={tag} className="text-xs px-2 py-1 bg-white/10 rounded">
                                {tag}
                              </span>
                            ))}
                            {'value' in metadata && metadata.value && (
                              <span className="text-xs px-2 py-1 bg-white/10 rounded">
                                {metadata.value > 0 ? '+' : ''}{(metadata.value * 100).toFixed(1)}%
                              </span>
                            )}
                            {'economicImpact' in metadata && metadata.economicImpact && (
                              <span className="text-xs px-2 py-1 bg-white/10 rounded">
                                Impact: ${metadata.economicImpact.toLocaleString()}
                              </span>
                            )}
                            {'status' in metadata && metadata.status && (
                              <span className="text-xs px-2 py-1 bg-white/10 rounded">
                                {String(metadata.status)}
                              </span>
                            )}
                            {'relatedCountry' in metadata && metadata.relatedCountry && (
                              <span className="text-xs px-2 py-1 bg-white/10 rounded">
                                {String(metadata.relatedCountry)}
                              </span>
                            )}
                            {'relatedCountries' in metadata && Array.isArray(metadata.relatedCountries) && metadata.relatedCountries.length > 0 && (
                              <span className="text-xs px-2 py-1 bg-white/10 rounded">
                                {metadata.relatedCountries.join(', ')}
                              </span>
                            )}
                            {'scheduledDate' in metadata && metadata.scheduledDate && (
                              <span className="text-xs px-2 py-1 bg-white/10 rounded">
                                {`Starts ${formatTimeAgo(metadata.scheduledDate as string)}`}
                              </span>
                            )}
                            {'category' in metadata && metadata.category && (
                              <span className="text-xs px-2 py-1 bg-white/10 rounded">
                                {metadata.category}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
        
        {allEvents.length > 10 && (
          <Button variant="outline" size="sm" className="w-full">
            View All Events ({allEvents.length})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
