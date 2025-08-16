"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Crown, 
  Factory, 
  Globe, 
  Clock,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';
import { IxTime } from '~/lib/ixtime';

interface LiveEventsFeedProps {
  countryId: string;
  onEventClick?: (eventId: string) => void;
}

export function LiveEventsFeed({ countryId, onEventClick }: LiveEventsFeedProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Get latest economic milestones
  const { data: milestones } = api.countries.getEconomicMilestones.useQuery(
    { countryId, limit: 5 },
    { refetchInterval: 30000 } // Refresh every 30 seconds
  );

  // Get latest crisis events
  const { data: crisisEvents } = api.countries.getCrisisEvents.useQuery(
    { countryId, limit: 3 },
    { refetchInterval: 30000 }
  );

  // Get recent diplomatic relations changes
  const { data: diplomaticChanges } = api.diplomatic.getRecentChanges.useQuery(
    { countryId, hours: 24 },
    { refetchInterval: 60000 } // Refresh every minute
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'economic_growth': return TrendingUp;
      case 'economic_decline': return TrendingDown;
      case 'crisis': return AlertTriangle;
      case 'diplomatic': return Globe;
      case 'industrial': return Factory;
      case 'government': return Crown;
      default: return Zap;
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
      case 'industrial': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const formatTimeAgo = (timestamp: string | Date) => {
    const now = IxTime.getCurrentIxTime();
    const eventTime = new Date(timestamp);
    const diffMs = now - eventTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const allEvents = [
    ...(milestones?.map(m => ({
      id: m.id,
      type: m.value > 0 ? 'economic_growth' : 'economic_decline',
      title: m.title,
      description: m.description,
      timestamp: m.achievedAt,
      metadata: { value: m.value, category: m.category }
    })) || []),
    ...(crisisEvents?.map(c => ({
      id: c.id,
      type: 'crisis',
      title: c.title,
      description: c.description,
      timestamp: c.createdAt,
      severity: c.severity,
      metadata: { economicImpact: c.economicImpact, affectedCountries: c.affectedCountries }
    })) || []),
    ...(diplomaticChanges?.map(d => ({
      id: d.id,
      type: 'diplomatic',
      title: `Diplomatic Relations Update: ${d.targetCountry}`,
      description: `Relationship status changed to ${d.currentStatus}`,
      timestamp: d.updatedAt,
      metadata: { targetCountry: d.targetCountry, previousStatus: d.previousStatus }
    })) || [])
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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
          {allEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No recent events</p>
              <p className="text-xs">Events will appear as they occur</p>
            </div>
          ) : (
            allEvents.slice(0, 10).map((event, index) => {
              const Icon = getEventIcon(event.type);
              const colorClasses = getEventColor(event.type, 'severity' in event ? event.severity : undefined);
              
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
                          {'severity' in event && event.severity && (
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
                      {event.metadata && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {'value' in event.metadata && event.metadata.value && (
                            <span className="text-xs px-2 py-1 bg-white/10 rounded">
                              {event.metadata.value > 0 ? '+' : ''}{(event.metadata.value * 100).toFixed(1)}%
                            </span>
                          )}
                          {'economicImpact' in event.metadata && event.metadata.economicImpact && (
                            <span className="text-xs px-2 py-1 bg-white/10 rounded">
                              Impact: ${event.metadata.economicImpact.toLocaleString()}
                            </span>
                          )}
                          {'category' in event.metadata && event.metadata.category && (
                            <span className="text-xs px-2 py-1 bg-white/10 rounded">
                              {event.metadata.category}
                            </span>
                          )}
                        </div>
                      )}
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