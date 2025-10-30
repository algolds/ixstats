/**
 * AgendaManager Component
 *
 * Form for adding and displaying agenda items.
 *
 * @module AgendaManager
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Clock, ListChecks, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { getPriorityColor, type AgendaItem } from '~/lib/meeting-scheduler-utils';
import type { AgendaItemForm } from '~/hooks/useMeetingScheduler';

interface AgendaManagerProps {
  form: AgendaItemForm;
  agendaItems: AgendaItem[];
  isLoading: boolean;
  onFormChange: (form: AgendaItemForm) => void;
  onAddItem: () => void;
  className?: string;
}

export const AgendaManager = React.memo<AgendaManagerProps>(({
  form,
  agendaItems,
  isLoading,
  onFormChange,
  onAddItem,
  className
}) => {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className || ''}`}>
      {/* Add Form */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="text-lg">Add Agenda Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="e.g., Budget allocation discussion"
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Details and context..."
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (min)</label>
              <Input
                type="number"
                min={5}
                max={120}
                value={form.estimatedDuration}
                onChange={(e) =>
                  onFormChange({ ...form, estimatedDuration: parseInt(e.target.value) || 15 })
                }
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
            onClick={onAddItem}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardContent>
      </Card>

      {/* Current Agenda */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="text-lg">Current Agenda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {agendaItems && agendaItems.length > 0 ? (
            agendaItems
              .sort((a, b) => a.order - b.order)
              .map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-3 rounded-lg border border-border bg-card hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{item.title}</h4>
                        <Badge className={getPriorityColor(item.priority || 'medium')}>
                          {item.priority || 'medium'}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.estimatedDuration || item.duration || 30} min
                        </span>
                        {item.status && (
                          <Badge variant="outline" className="text-xs">
                            {item.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No agenda items yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

AgendaManager.displayName = 'AgendaManager';
