"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { ScrollArea } from '~/components/ui/scroll-area';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Target,
  TrendingUp,
  Users,
  Globe,
  Building,
  Play,
  Pause,
  X,
  Info,
  Zap,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import type { ActionableRecommendation } from '~/app/mycountry/types/intelligence';
import { actionQueueManager, type ActionQueueItem, type ActionExecutionPlan } from '~/lib/action-queue-system';

interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendation: ActionableRecommendation;
  onConfirm?: (actionId: string) => void;
  onCancel?: () => void;
}

const categoryIcons = {
  economic: DollarSign,
  population: Users,
  diplomatic: Globe,
  governance: Building
};

export function ActionDialog({
  open,
  onOpenChange,
  recommendation,
  onConfirm,
  onCancel
}: ActionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [actionItem, setActionItem] = useState<ActionQueueItem | null>(null);
  const [executionPlan, setExecutionPlan] = useState<ActionExecutionPlan | null>(null);
  const [view, setView] = useState<'confirm' | 'monitor'>('confirm');

  useEffect(() => {
    if (open && view === 'confirm') {
      // Generate execution plan when dialog opens
      const plan = actionQueueManager.generateExecutionPlan(recommendation);
      setExecutionPlan(plan);
    }
  }, [open, recommendation, view]);

  useEffect(() => {
    if (!actionItem) return;

    // Subscribe to action updates
    const unsubscribe = actionQueueManager.subscribe((queue) => {
      const updated = queue.find(item => item.id === actionItem.id);
      if (updated) {
        setActionItem(updated);

        // Show completion toast and close dialog
        if (updated.status === 'completed' && actionItem.status !== 'completed') {
          toast.success('Action Completed!', {
            description: `${recommendation.title} has been successfully completed.`
          });
          setTimeout(() => onOpenChange(false), 2000);
        }
      }
    });

    return unsubscribe;
  }, [actionItem, recommendation.title, onOpenChange]);

  const handleConfirm = () => {
    setLoading(true);

    try {
      // Add to action queue
      const priority = recommendation.urgency === 'urgent' ? 'critical' :
                      recommendation.urgency === 'important' ? 'high' : 'medium';

      const item = actionQueueManager.addToQueue(recommendation, priority);
      setActionItem(item);

      // Confirm and start the action
      actionQueueManager.confirmAction(item.id);

      toast.success('Action Queued', {
        description: 'The action has been added to your action queue and will begin processing.'
      });

      // Switch to monitor view
      setView('monitor');

      if (onConfirm) {
        onConfirm(item.id);
      }
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to queue action'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePause = () => {
    if (!actionItem) return;

    try {
      if (actionItem.status === 'in_progress') {
        actionQueueManager.pauseAction(actionItem.id);
        toast.info('Action Paused', {
          description: 'The action has been paused. You can resume it anytime.'
        });
      } else if (actionItem.status === 'paused') {
        actionQueueManager.resumeAction(actionItem.id);
        toast.info('Action Resumed', {
          description: 'The action has been resumed and will continue processing.'
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to pause/resume action'
      });
    }
  };

  const handleCancel = () => {
    if (actionItem) {
      actionQueueManager.cancelAction(actionItem.id);
      toast.info('Action Cancelled', {
        description: 'The action has been cancelled.'
      });
    }

    if (onCancel) {
      onCancel();
    }

    onOpenChange(false);
  };

  const CategoryIcon = categoryIcons[recommendation.category];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        {view === 'confirm' ? (
          // Confirmation View
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
                  <CategoryIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle>{recommendation.title}</DialogTitle>
                  <DialogDescription className="mt-1">
                    Review the details and confirm this action
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {/* Overview */}
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground mb-4">{recommendation.description}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium">Duration</span>
                        </div>
                        <p className="text-sm font-semibold">{recommendation.estimatedDuration}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium">Success Rate</span>
                        </div>
                        <p className="text-sm font-semibold">{recommendation.successProbability}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium">Est. Cost</span>
                        </div>
                        <p className="text-sm font-semibold">{recommendation.estimatedCost}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium">Est. Benefit</span>
                        </div>
                        <p className="text-sm font-semibold">{recommendation.estimatedBenefit}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Expected Impact */}
                {(recommendation.impact.economic || recommendation.impact.social || recommendation.impact.diplomatic) && (
                  <Card>
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-purple-600" />
                        Expected Impact
                      </h4>
                      <div className="space-y-2">
                        {recommendation.impact.economic && (
                          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <span className="text-sm">Economic</span>
                            <Badge variant={recommendation.impact.economic > 0 ? 'default' : 'destructive'}>
                              {recommendation.impact.economic > 0 ? '+' : ''}{recommendation.impact.economic}%
                            </Badge>
                          </div>
                        )}
                        {recommendation.impact.social && (
                          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <span className="text-sm">Social</span>
                            <Badge variant={recommendation.impact.social > 0 ? 'default' : 'destructive'}>
                              {recommendation.impact.social > 0 ? '+' : ''}{recommendation.impact.social}%
                            </Badge>
                          </div>
                        )}
                        {recommendation.impact.diplomatic && (
                          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <span className="text-sm">Diplomatic</span>
                            <Badge variant={recommendation.impact.diplomatic > 0 ? 'default' : 'destructive'}>
                              {recommendation.impact.diplomatic > 0 ? '+' : ''}{recommendation.impact.diplomatic}%
                            </Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Execution Plan */}
                {executionPlan && (
                  <Card>
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        Execution Plan
                      </h4>
                      <div className="space-y-2 mb-3">
                        {executionPlan.phases.slice(0, 5).map((phase, i) => (
                          <div key={phase.id} className="flex items-center gap-2 text-sm">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {i + 1}
                            </div>
                            <span className="text-muted-foreground">{phase.name}</span>
                          </div>
                        ))}
                        {executionPlan.phases.length > 5 && (
                          <p className="text-xs text-muted-foreground ml-8">
                            +{executionPlan.phases.length - 5} more phases...
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Prerequisites & Risks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recommendation.prerequisites.length > 0 && (
                    <Card>
                      <CardContent className="pt-4">
                        <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Prerequisites
                        </h4>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          {recommendation.prerequisites.map((prereq, i) => (
                            <li key={i}>• {prereq}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {recommendation.risks.length > 0 && (
                    <Card className="border-yellow-200 dark:border-yellow-800/40">
                      <CardContent className="pt-4">
                        <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          Risks
                        </h4>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          {recommendation.risks.map((risk, i) => (
                            <li key={i}>• {risk}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? 'Processing...' : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Confirm & Start
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Monitor View
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                  <CategoryIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle>{recommendation.title}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {actionItem?.status === 'completed' ? 'Action completed successfully' :
                     actionItem?.status === 'in_progress' ? 'Action in progress' :
                     actionItem?.status === 'paused' ? 'Action paused' :
                     'Action queued'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {actionItem && (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <Badge variant={
                    actionItem.status === 'completed' ? 'default' :
                    actionItem.status === 'in_progress' ? 'secondary' :
                    actionItem.status === 'paused' ? 'outline' : 'secondary'
                  } className="capitalize">
                    {actionItem.status.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline">
                    Phase {actionItem.completedPhases + 1} of {actionItem.totalPhases}
                  </Badge>
                </div>

                {/* Progress */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Overall Progress</span>
                        <span className="text-sm font-bold text-purple-600">{actionItem.progress}%</span>
                      </div>
                      <Progress value={actionItem.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Current phase: {actionItem.currentPhase}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-semibold mb-3 text-sm">Timeline</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Started</span>
                        <span>{actionItem.startedAt ? new Date(actionItem.startedAt).toLocaleString() : 'Not yet'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Est. Completion</span>
                        <span>{actionItem.estimatedCompletionAt ? new Date(actionItem.estimatedCompletionAt).toLocaleString() : 'Unknown'}</span>
                      </div>
                      {actionItem.completedAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Completed</span>
                          <span>{new Date(actionItem.completedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Impact (if completed) */}
                {actionItem.actualImpact && (
                  <Card className="border-green-200 dark:border-green-800/40">
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Actual Impact
                      </h4>
                      <div className="space-y-2">
                        {actionItem.actualImpact.economic && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Economic</span>
                            <Badge variant="default">+{actionItem.actualImpact.economic}%</Badge>
                          </div>
                        )}
                        {actionItem.actualImpact.social && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Social</span>
                            <Badge variant="default">+{actionItem.actualImpact.social}%</Badge>
                          </div>
                        )}
                        {actionItem.actualImpact.diplomatic && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Diplomatic</span>
                            <Badge variant="default">+{actionItem.actualImpact.diplomatic}%</Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <DialogFooter>
              {actionItem?.status === 'in_progress' && (
                <Button variant="outline" onClick={handlePause}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              {actionItem?.status === 'paused' && (
                <Button variant="outline" onClick={handlePause}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}
              {actionItem?.status !== 'completed' && actionItem?.status !== 'failed' && (
                <Button variant="destructive" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel Action
                </Button>
              )}
              {(actionItem?.status === 'completed' || actionItem?.status === 'failed') && (
                <Button onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
