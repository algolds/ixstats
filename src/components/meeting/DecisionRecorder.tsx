/**
 * DecisionRecorder Component
 *
 * Form for recording meeting decisions with voting results.
 *
 * @module DecisionRecorder
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Vote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { getOutcomeColor, type Decision } from '~/lib/meeting-scheduler-utils';
import type { DecisionForm } from '~/hooks/useMeetingScheduler';

interface DecisionRecorderProps {
  form: DecisionForm;
  decisions: Decision[];
  isLoading: boolean;
  onFormChange: (form: DecisionForm) => void;
  onRecordDecision: () => void;
  className?: string;
}

export const DecisionRecorder = React.memo<DecisionRecorderProps>(({
  form,
  decisions,
  isLoading,
  onFormChange,
  onRecordDecision,
  className
}) => {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className || ''}`}>
      {/* Record Form */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="text-lg">Record Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Decision Title</label>
            <Input
              placeholder="e.g., Approve education budget increase"
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Decision details and rationale..."
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select
                value={form.decisionType}
                onValueChange={(v) => onFormChange({ ...form, decisionType: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="personnel">Personnel</SelectItem>
                  <SelectItem value="strategic">Strategic</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Outcome</label>
              <Select
                value={form.outcome}
                onValueChange={(v) => onFormChange({ ...form, outcome: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="deferred">Deferred</SelectItem>
                  <SelectItem value="requires_review">Requires Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Votes For</label>
              <Input
                type="number"
                min={0}
                value={form.votesFor || ''}
                onChange={(e) =>
                  onFormChange({ ...form, votesFor: parseInt(e.target.value) || undefined })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Votes Against</label>
              <Input
                type="number"
                min={0}
                value={form.votesAgainst || ''}
                onChange={(e) =>
                  onFormChange({ ...form, votesAgainst: parseInt(e.target.value) || undefined })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Abstain</label>
              <Input
                type="number"
                min={0}
                value={form.votesAbstain || ''}
                onChange={(e) =>
                  onFormChange({ ...form, votesAbstain: parseInt(e.target.value) || undefined })
                }
              />
            </div>
          </div>

          <Button
            onClick={onRecordDecision}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white"
          >
            <Vote className="h-4 w-4 mr-2" />
            Record Decision
          </Button>
        </CardContent>
      </Card>

      {/* Recorded Decisions */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="text-lg">Recorded Decisions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {decisions && decisions.length > 0 ? (
            decisions.map((decision, index) => (
              <motion.div
                key={decision.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{decision.title}</h4>
                      <Badge className={getOutcomeColor(decision.outcome || 'pending')}>
                        {decision.outcome || 'pending'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {decision.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <Badge variant="outline">{decision.decisionType}</Badge>
                      {(decision.votesFor !== null || decision.votesAgainst !== null) && (
                        <span className="text-muted-foreground">
                          {decision.votesFor || 0} for, {decision.votesAgainst || 0} against
                          {decision.votesAbstain ? `, ${decision.votesAbstain} abstain` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Vote className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No decisions recorded yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

DecisionRecorder.displayName = 'DecisionRecorder';
