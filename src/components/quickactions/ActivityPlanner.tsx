// src/components/quickactions/ActivityPlanner.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { api } from '~/trpc/react';
import { IxTime } from '~/lib/ixtime';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Calendar,
  Clock,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  Filter,
  CalendarDays,
  ListTodo,
  Zap
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { MeetingScheduler } from './MeetingScheduler';
import { PolicyCreator } from './PolicyCreator';
import { MeetingDecisionsModal } from './MeetingDecisionsModal';

interface ActivityPlannerProps {
  countryId: string;
  userId: string;
  className?: string;
}

type ViewMode = 'week' | 'month' | 'upcoming';

const ACTIVITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  meeting: { bg: 'bg-blue-100 dark:bg-blue-950/30', border: 'border-blue-300', text: 'text-blue-700' },
  policy_review: { bg: 'bg-green-100 dark:bg-green-950/30', border: 'border-green-300', text: 'text-green-700' },
  economic_review: { bg: 'bg-purple-100 dark:bg-purple-950/30', border: 'border-purple-300', text: 'text-purple-700' },
  diplomatic_event: { bg: 'bg-amber-100 dark:bg-amber-950/30', border: 'border-amber-300', text: 'text-amber-700' },
  custom: { bg: 'bg-gray-100 dark:bg-gray-950/30', border: 'border-gray-300', text: 'text-gray-700' },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-gray-500',
};

export function ActivityPlanner({ countryId, userId, className }: ActivityPlannerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showMeetingScheduler, setShowMeetingScheduler] = useState(false);
  const [showPolicyCreator, setShowPolicyCreator] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<{ id: string; title: string } | null>(null);

  // Calculate date range based on view mode (using IxTime)
  const dateRange = useMemo(() => {
    const currentIxTime = IxTime.getCurrentIxTime();
    const currentIxDate = new Date(currentIxTime);
    const selectedIxDate = new Date(selectedDate);

    if (viewMode === 'week') {
      const start = startOfWeek(selectedIxDate, { weekStartsOn: 1 }); // Monday
      const end = endOfWeek(selectedIxDate, { weekStartsOn: 1 });
      return { start, end };
    } else if (viewMode === 'month') {
      const start = new Date(selectedIxDate.getFullYear(), selectedIxDate.getMonth(), 1);
      const end = new Date(selectedIxDate.getFullYear(), selectedIxDate.getMonth() + 1, 0);
      return { start, end };
    } else {
      // Upcoming (next 7 days in IxTime)
      const start = currentIxDate;
      const end = addDays(currentIxDate, 7);
      return { start, end };
    }
  }, [viewMode, selectedDate]);

  // Fetch activities for the date range
  const { data: activities, isLoading, refetch } = api.quickActions.getActivitySchedule.useQuery({
    countryId,
    userId,
    fromDate: dateRange.start,
    toDate: dateRange.end,
  });

  // Fetch meetings separately for more detail
  const { data: meetings } = api.quickActions.getMeetings.useQuery({
    countryId,
    userId,
    fromDate: dateRange.start,
    toDate: dateRange.end,
  });

  // Fetch upcoming activities for quick view
  const { data: upcomingActivities } = api.quickActions.getUpcomingActivities.useQuery({
    countryId,
    userId,
    days: 7,
  });

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      setSelectedDate(addDays(selectedDate, -7));
    } else if (viewMode === 'month') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setSelectedDate(addDays(selectedDate, 7));
    } else if (viewMode === 'month') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Group activities by day (using IxTime)
  const activitiesByDay = useMemo(() => {
    if (!activities) return new Map<string, typeof activities>();

    const grouped = new Map<string, typeof activities>();

    activities.forEach(activity => {
      // Use IxTime for grouping if available, otherwise fall back to scheduledDate
      const ixTime = activity.scheduledIxTime ?? IxTime.convertToIxTime(activity.scheduledDate.getTime());
      const dayKey = format(new Date(ixTime), 'yyyy-MM-dd');
      const existing = grouped.get(dayKey) ?? [];
      grouped.set(dayKey, [...existing, activity]);
    });

    // Sort activities within each day by IxTime
    grouped.forEach((dayActivities, key) => {
      grouped.set(
        key,
        dayActivities.sort((a, b) => {
          const aTime = a.scheduledIxTime ?? IxTime.convertToIxTime(a.scheduledDate.getTime());
          const bTime = b.scheduledIxTime ?? IxTime.convertToIxTime(b.scheduledDate.getTime());
          return aTime - bTime;
        })
      );
    });

    return grouped;
  }, [activities]);

  // Generate days for week view
  const weekDays = useMemo(() => {
    const days = [];
    let current = dateRange.start;
    while (current <= dateRange.end) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    return days;
  }, [dateRange]);

  const handleMeetingComplete = (meetingId: string, title: string) => {
    setSelectedMeeting({ id: meetingId, title });
  };

  const ActivityCard = ({ activity }: { activity: any }) => {
    const colors = ACTIVITY_COLORS[activity.activityType] || ACTIVITY_COLORS.custom;
    const priorityColor = PRIORITY_COLORS[activity.priority] || PRIORITY_COLORS.normal;

    // Use IxTime if available, otherwise convert from scheduledDate
    const ixTime = activity.scheduledIxTime ?? IxTime.convertToIxTime(activity.scheduledDate.getTime());
    const ixDate = new Date(ixTime);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`p-2 rounded-md border ${colors.bg} ${colors.border} cursor-pointer hover:shadow-md transition-all`}
        onClick={() => {
          if (activity.activityType === 'meeting' && activity.status === 'completed') {
            // Find the actual meeting ID from relatedIds
            const relatedIds = activity.relatedIds;
            if (relatedIds?.meetingId) {
              handleMeetingComplete(relatedIds.meetingId, activity.title);
            }
          }
        }}
      >
        <div className="flex items-start gap-2">
          <div className={`h-2 w-2 rounded-full ${priorityColor} mt-1.5 flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold ${colors.text}`}>
                {format(ixDate, 'HH:mm')} ILT
              </span>
              <Badge variant="outline" className="text-xs">
                {activity.activityType.replace('_', ' ')}
              </Badge>
              {activity.status === 'completed' && (
                <Badge variant="default" className="text-xs bg-green-600">
                  ✓
                </Badge>
              )}
            </div>
            <h4 className="text-sm font-medium truncate">{activity.title}</h4>
            {activity.duration && (
              <p className="text-xs text-muted-foreground">
                {activity.duration} minutes
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={className}>
      <Card className="glass-hierarchy-parent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              Activity Planner
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowMeetingScheduler(true)}>
                <Users className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPolicyCreator(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Create Policy
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="upcoming">
                  <ListTodo className="h-4 w-4 mr-2" />
                  Upcoming
                </TabsTrigger>
                <TabsTrigger value="week">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Week
                </TabsTrigger>
                <TabsTrigger value="month">
                  <Calendar className="h-4 w-4 mr-2" />
                  Month
                </TabsTrigger>
              </TabsList>

              {viewMode !== 'upcoming' && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={navigatePrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={navigateNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium ml-2">
                    {viewMode === 'week'
                      ? `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`
                      : format(selectedDate, 'MMMM yyyy')}
                  </span>
                </div>
              )}
            </div>

            {/* Upcoming View */}
            <TabsContent value="upcoming" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading activities...</p>
                </div>
              ) : upcomingActivities && upcomingActivities.length > 0 ? (
                <div className="space-y-3">
                  {upcomingActivities.map((activity, index) => {
                    const ixTime = activity.scheduledIxTime ?? IxTime.convertToIxTime(activity.scheduledDate.getTime());
                    const ixDate = new Date(ixTime);

                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex items-start gap-3 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                          <div className="text-center min-w-[60px]">
                            <div className="text-2xl font-bold">{format(ixDate, 'd')}</div>
                            <div className="text-xs text-blue-600 uppercase font-semibold">
                              {format(ixDate, 'MMM')} ILT
                            </div>
                            <div className="text-xs text-muted-foreground">{format(ixDate, 'EEE')}</div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-blue-600">
                                {format(ixDate, 'HH:mm')} ILT
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {activity.activityType.replace('_', ' ')}
                              </Badge>
                              <Badge
                                variant={
                                  activity.priority === 'urgent' ? 'destructive' :
                                  activity.priority === 'high' ? 'default' : 'secondary'
                                }
                                className="text-xs"
                              >
                                {activity.priority}
                              </Badge>
                            </div>
                            <h4 className="font-semibold mb-1">{activity.title}</h4>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
                            )}
                            {activity.tags && activity.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {activity.tags.map((tag: string) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-blue-600 font-medium mt-2">
                              📅 {IxTime.formatIxTime(ixTime, true)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarDays className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No upcoming activities</p>
                  <p className="text-sm">Schedule meetings or create policies to get started</p>
                </div>
              )}
            </TabsContent>

            {/* Week View */}
            <TabsContent value="week">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading activities...</p>
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day, index) => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayActivities = activitiesByDay.get(dayKey) ?? [];
                    const isToday = isSameDay(day, new Date());

                    return (
                      <div
                        key={dayKey}
                        className={`min-h-[200px] p-3 border rounded-lg ${
                          isToday ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300' : 'bg-card'
                        }`}
                      >
                        <div className="text-center mb-3">
                          <div className="text-xs text-muted-foreground uppercase">
                            {format(day, 'EEE')}
                          </div>
                          <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : ''}`}>
                            {format(day, 'd')}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {dayActivities.map((activity) => (
                            <ActivityCard key={activity.id} activity={activity} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Month View */}
            <TabsContent value="month">
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Month view coming soon</p>
                <p className="text-sm">Use week view or upcoming view for now</p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Activity Statistics */}
          {activities && activities.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {activities.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Activities</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {activities.filter(a => a.status === 'completed').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">
                    {activities.filter(a => a.status === 'in_progress').length}
                  </div>
                  <div className="text-sm text-muted-foreground">In Progress</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {activities.filter(a => a.priority === 'urgent' || a.priority === 'high').length}
                  </div>
                  <div className="text-sm text-muted-foreground">High Priority</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <MeetingScheduler
        countryId={countryId}
        open={showMeetingScheduler}
        onOpenChange={setShowMeetingScheduler}
      />

      <PolicyCreator
        countryId={countryId}
        open={showPolicyCreator}
        onOpenChange={setShowPolicyCreator}
        onSuccess={() => {
          void refetch();
        }}
      />

      {selectedMeeting && (
        <MeetingDecisionsModal
          meetingId={selectedMeeting.id}
          meetingTitle={selectedMeeting.title}
          open={!!selectedMeeting}
          onOpenChange={(open) => {
            if (!open) setSelectedMeeting(null);
          }}
          onComplete={() => {
            void refetch();
          }}
        />
      )}
    </div>
  );
}
