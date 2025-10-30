/**
 * MeetingCard Component
 *
 * Displays individual meeting information with expandable details.
 *
 * @module MeetingCard
 */

import React from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { Clock, Users, ListChecks, FileText, Trash2, ChevronRight } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { getStatusColor, type Meeting } from "~/lib/meeting-scheduler-utils";

interface MeetingCardProps {
  meeting: Meeting;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onDelete: (id: string) => void;
  onManageAgenda: () => void;
  onViewMinutes: () => void;
  index?: number;
}

export const MeetingCard = React.memo<MeetingCardProps>(
  ({
    meeting,
    isSelected,
    isExpanded,
    onSelect,
    onToggleExpanded,
    onDelete,
    onManageAgenda,
    onViewMinutes,
    index = 0,
  }) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ delay: index * 0.1 }}
      >
        <Card
          className={cn(
            "glass-hierarchy-child cursor-pointer transition-all hover:shadow-md",
            isSelected && "ring-2 ring-amber-500"
          )}
          onClick={() => {
            onSelect(meeting.id);
            onToggleExpanded(meeting.id);
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="font-semibold">{meeting.title}</h4>
                  <Badge className={getStatusColor(meeting.status || "scheduled")}>
                    {meeting.status || "scheduled"}
                  </Badge>
                </div>

                <div className="text-muted-foreground mb-2 flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(meeting.scheduledDate).toLocaleTimeString()}
                  </span>
                  {meeting.duration && <span>{meeting.duration} min</span>}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {meeting.attendances?.length || 0} attendees
                  </span>
                </div>

                {meeting.description && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {meeting.description}
                  </p>
                )}

                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 space-y-3 border-t pt-4"
                  >
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
                        <p className="text-muted-foreground mb-1 text-xs">Agenda Items</p>
                        <p className="text-lg font-bold text-blue-600">
                          {meeting.agendaItems?.length || 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
                        <p className="text-muted-foreground mb-1 text-xs">Decisions</p>
                        <p className="text-lg font-bold text-green-600">
                          {meeting.decisions?.length || 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-950/20">
                        <p className="text-muted-foreground mb-1 text-xs">Actions</p>
                        <p className="text-lg font-bold text-purple-600">
                          {meeting.actionItems?.length || 0}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onManageAgenda();
                        }}
                      >
                        <ListChecks className="mr-1 h-4 w-4" />
                        Manage Agenda
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewMinutes();
                        }}
                      >
                        <FileText className="mr-1 h-4 w-4" />
                        View Minutes
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(meeting.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
              <ChevronRight
                className={cn(
                  "text-muted-foreground h-5 w-5 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }
);

MeetingCard.displayName = "MeetingCard";
