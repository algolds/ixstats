/**
 * ActionItemManager Component
 *
 * Form for creating and tracking action items from meetings.
 *
 * @module ActionItemManager
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Target, User, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Calendar } from '~/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { getPriorityColor, type ActionItem } from '~/lib/meeting-scheduler-utils';
import type { ActionItemForm } from '~/hooks/useMeetingScheduler';

interface Official {
  id: string;
  name: string;
  title: string;
}

interface ActionItemManagerProps {
  form: ActionItemForm;
  actionItems: ActionItem[];
  officials?: Official[];
  isLoading: boolean;
  onFormChange: (form: ActionItemForm) => void;
  onCreateAction: () => void;
  className?: string;
}

export const ActionItemManager = React.memo<ActionItemManagerProps>(({
  form,
  actionItems,
  officials,
  isLoading,
  onFormChange,
  onCreateAction,
  className
}) => {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className || ''}`}>
      {/* Create Form */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="text-lg">Create Action Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="e.g., Draft new policy document"
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Action details and requirements..."
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Assign To</label>
            <Select
              value={form.assignedToId}
              onValueChange={(v) => onFormChange({ ...form, assignedToId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select official" />
              </SelectTrigger>
              <SelectContent>
                {officials && officials.length > 0 ? (
                  officials.map((official) => (
                    <SelectItem key={official.id} value={official.id}>
                      {official.name} - {official.title}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No officials available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Calendar
                mode="single"
                selected={form.dueDate}
                onSelect={(date) => date && onFormChange({ ...form, dueDate: date })}
                className="rounded-md border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select
                value={form.priority}
                onValueChange={(v) => onFormChange({ ...form, priority: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={onCreateAction}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Action
          </Button>
        </CardContent>
      </Card>

      {/* Action Items List */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="text-lg">Action Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionItems && actionItems.length > 0 ? (
            actionItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{item.title}</h4>
                      <Badge className={getPriorityColor(item.priority || 'medium')}>
                        {item.priority}
                      </Badge>
                      {item.status && (
                        <Badge variant="outline" className="text-xs">
                          {item.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Assigned
                      </span>
                      {item.dueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          Due {new Date(item.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No action items yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

ActionItemManager.displayName = 'ActionItemManager';
