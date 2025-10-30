"use client";

/**
 * MeetingScheduler Component (Refactored)
 *
 * Main orchestrator for meeting scheduling functionality.
 * Implements modular architecture with separated concerns:
 * - Business logic in ~/lib/meeting-scheduler-utils.ts
 * - State management in ~/hooks/useMeetingScheduler.ts
 * - UI components in ~/components/meeting/
 *
 * @module MeetingScheduler
 */

import React from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { Calendar as CalendarIcon, Plus, ListChecks, FileText, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useMeetingScheduler } from "~/hooks/useMeetingScheduler";
import {
  MeetingCalendar,
  MeetingList,
  MeetingForm,
  AgendaManager,
  DecisionRecorder,
  ActionItemManager,
} from "~/components/meeting";

// ============================================================================
// Types
// ============================================================================

interface MeetingSchedulerProps {
  countryId: string;
  userId: string;
  governmentStructureId?: string;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function MeetingScheduler({
  countryId,
  userId,
  governmentStructureId,
  className,
}: MeetingSchedulerProps) {
  // ============================================================================
  // State Management Hook
  // ============================================================================

  const scheduler = useMeetingScheduler(countryId, userId, governmentStructureId);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (scheduler.meetingsLoading) {
    return (
      <Card className={cn("glass-hierarchy-parent", className)}>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-8 w-1/3 rounded"></div>
            <div className="bg-muted h-48 rounded"></div>
            <div className="bg-muted h-24 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={className}
    >
      <Card className="glass-hierarchy-parent">
        {/* Header */}
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-amber-600" />
                Meeting Scheduler
              </CardTitle>
              <CardDescription>
                Schedule cabinet meetings, manage agendas, and track decisions
              </CardDescription>
            </div>

            {/* Create Meeting Dialog */}
            <Dialog
              open={scheduler.createMeetingOpen}
              onOpenChange={scheduler.setCreateMeetingOpen}
            >
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-amber-600 to-amber-700 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule Meeting
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-hierarchy-modal max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Schedule New Meeting</DialogTitle>
                  <DialogDescription>
                    Create a new cabinet meeting with agenda items and attendees
                  </DialogDescription>
                </DialogHeader>

                <MeetingForm form={scheduler.meetingForm} onChange={scheduler.setMeetingForm} />

                <DialogFooter>
                  <Button variant="outline" onClick={() => scheduler.setCreateMeetingOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={scheduler.handleCreateMeeting}
                    disabled={scheduler.isCreatingMeeting}
                    className="bg-gradient-to-r from-amber-600 to-amber-700 text-white"
                  >
                    {scheduler.isCreatingMeeting ? "Creating..." : "Create Meeting"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        {/* Main Content */}
        <CardContent>
          <Tabs
            value={scheduler.activeTab}
            onValueChange={(v) => scheduler.setActiveTab(v as any)}
            className="space-y-4"
          >
            {/* Tab Navigation */}
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="agenda" className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Agenda
              </TabsTrigger>
              <TabsTrigger value="minutes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Minutes
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Actions
              </TabsTrigger>
            </TabsList>

            {/* Calendar Tab */}
            <TabsContent value="calendar" className="space-y-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <MeetingCalendar
                  selectedDate={scheduler.selectedDate}
                  onSelectDate={scheduler.setSelectedDate}
                  meetingCount={scheduler.filteredMeetings.length}
                  className="lg:col-span-1"
                />

                <MeetingList
                  meetings={scheduler.filteredMeetings}
                  selectedMeetingId={scheduler.selectedMeetingId}
                  expandedMeetings={scheduler.expandedMeetings}
                  onSelectMeeting={scheduler.setSelectedMeetingId}
                  onToggleExpanded={scheduler.toggleMeetingExpanded}
                  onDeleteMeeting={scheduler.handleDeleteMeeting}
                  onManageAgenda={() => scheduler.setActiveTab("agenda")}
                  onViewMinutes={() => scheduler.setActiveTab("minutes")}
                  className="lg:col-span-2"
                />
              </div>
            </TabsContent>

            {/* Agenda Tab */}
            <TabsContent value="agenda" className="space-y-4">
              {!scheduler.selectedMeetingId ? (
                <div className="py-12 text-center">
                  <ListChecks className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">Select a meeting to manage its agenda</p>
                </div>
              ) : (
                <AgendaManager
                  form={scheduler.agendaForm}
                  agendaItems={scheduler.selectedMeeting?.agendaItems || []}
                  isLoading={scheduler.isAddingAgendaItem}
                  onFormChange={scheduler.setAgendaForm}
                  onAddItem={scheduler.handleAddAgendaItem}
                />
              )}
            </TabsContent>

            {/* Minutes Tab */}
            <TabsContent value="minutes" className="space-y-4">
              {!scheduler.selectedMeetingId ? (
                <div className="py-12 text-center">
                  <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">
                    Select a meeting to view or record minutes
                  </p>
                </div>
              ) : (
                <DecisionRecorder
                  form={scheduler.decisionForm}
                  decisions={scheduler.selectedMeeting?.decisions || []}
                  isLoading={scheduler.isRecordingDecision}
                  onFormChange={scheduler.setDecisionForm}
                  onRecordDecision={scheduler.handleRecordDecision}
                />
              )}
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value="actions" className="space-y-4">
              {!scheduler.selectedMeetingId ? (
                <div className="py-12 text-center">
                  <Target className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">Select a meeting to create action items</p>
                </div>
              ) : (
                <ActionItemManager
                  form={scheduler.actionForm}
                  actionItems={scheduler.selectedMeeting?.actionItems || []}
                  officials={scheduler.officials}
                  isLoading={scheduler.isCreatingActionItem}
                  onFormChange={scheduler.setActionForm}
                  onCreateAction={scheduler.handleCreateActionItem}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default MeetingScheduler;
