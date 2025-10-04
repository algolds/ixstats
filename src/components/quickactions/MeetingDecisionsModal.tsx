// src/components/quickactions/MeetingDecisionsModal.tsx
"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '~/trpc/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Checkbox } from '~/components/ui/checkbox';
import {
  CheckCircle2,
  ListTodo,
  Gavel,
  Plus,
  AlertCircle,
  Sparkles,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface MeetingDecisionsModalProps {
  meetingId: string;
  meetingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface Decision {
  title: string;
  description: string;
  decisionType: string;
  impact: string;
  createPolicy: boolean;
  policyData?: {
    name: string;
    policyType: string;
    category: string;
    gdpEffect: number;
    employmentEffect: number;
    inflationEffect: number;
    taxRevenueEffect: number;
  };
}

interface ActionItem {
  title: string;
  description: string;
  assignedTo: string;
  dueDate: Date | null;
  priority: string;
  category: string;
  tags: string[];
}

const DECISION_TYPES = [
  { value: 'policy_approval', label: 'Policy Approval', icon: '📋' },
  { value: 'budget_allocation', label: 'Budget Allocation', icon: '💰' },
  { value: 'appointment', label: 'Appointment/Personnel', icon: '👤' },
  { value: 'directive', label: 'Executive Directive', icon: '📄' },
  { value: 'resolution', label: 'Resolution', icon: '✅' },
  { value: 'other', label: 'Other', icon: '📌' },
];

export function MeetingDecisionsModal({
  meetingId,
  meetingTitle,
  open,
  onOpenChange,
  onComplete,
}: MeetingDecisionsModalProps) {
  const [activeTab, setActiveTab] = useState('suggested');
  const [notes, setNotes] = useState('');

  // Decisions
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionDesc, setNewDecisionDesc] = useState('');
  const [newDecisionType, setNewDecisionType] = useState('resolution');
  const [newDecisionImpact, setNewDecisionImpact] = useState('medium');

  // Action Items
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionDesc, setNewActionDesc] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState('');
  const [newActionPriority, setNewActionPriority] = useState('normal');

  // Complete meeting and get suggestions
  const completeMeeting = api.quickActions.completeMeeting.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      // Auto-add suggested decisions
      if (result.suggestedDecisions && result.suggestedDecisions.length > 0) {
        setActiveTab('decisions');
      }
    },
    onError: (error) => {
      toast.error(`Failed to complete meeting: ${error.message}`);
    },
  });

  // Create decisions
  const createDecision = api.quickActions.createDecision.useMutation({
    onSuccess: () => {
      toast.success('Decision recorded');
    },
    onError: (error) => {
      toast.error(`Failed to record decision: ${error.message}`);
    },
  });

  // Create action items
  const createActionItems = api.quickActions.createActionItems.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      onOpenChange(false);
      onComplete?.();
    },
    onError: (error) => {
      toast.error(`Failed to create action items: ${error.message}`);
    },
  });

  const handleCompleteMeeting = () => {
    completeMeeting.mutate({
      meetingId,
      notes,
    });
  };

  const addDecision = () => {
    if (!newDecisionTitle.trim() || !newDecisionDesc.trim()) {
      toast.error('Decision title and description are required');
      return;
    }

    const decision: Decision = {
      title: newDecisionTitle,
      description: newDecisionDesc,
      decisionType: newDecisionType,
      impact: newDecisionImpact,
      createPolicy: false,
    };

    setDecisions([...decisions, decision]);
    setNewDecisionTitle('');
    setNewDecisionDesc('');
    setNewDecisionType('resolution');
    setNewDecisionImpact('medium');
  };

  const addActionItem = () => {
    if (!newActionTitle.trim()) {
      toast.error('Action item title is required');
      return;
    }

    const action: ActionItem = {
      title: newActionTitle,
      description: newActionDesc,
      assignedTo: newActionAssignee,
      dueDate: null,
      priority: newActionPriority,
      category: '',
      tags: [],
    };

    setActionItems([...actionItems, action]);
    setNewActionTitle('');
    setNewActionDesc('');
    setNewActionAssignee('');
    setNewActionPriority('normal');
  };

  const handleFinalizeAndSave = async () => {
    // Save all decisions
    for (const decision of decisions) {
      await createDecision.mutateAsync({
        meetingId,
        title: decision.title,
        description: decision.description,
        decisionType: decision.decisionType as any,
        impact: decision.impact as any,
        createPolicy: decision.createPolicy,
        policyData: decision.policyData ? {
          ...decision.policyData,
          policyType: decision.policyData.policyType as 'economic' | 'social' | 'diplomatic' | 'infrastructure' | 'governance',
        } : undefined,
      });
    }

    // Save all action items
    if (actionItems.length > 0) {
      await createActionItems.mutateAsync({
        meetingId,
        items: actionItems.map(item => ({
          title: item.title,
          description: item.description || undefined,
          assignedTo: item.assignedTo || undefined,
          dueDate: item.dueDate || undefined,
          priority: item.priority as any,
          category: item.category || undefined,
          tags: item.tags,
        })),
      });
    } else {
      // If no action items, just close and complete
      onOpenChange(false);
      onComplete?.();
    }
  };

  const suggestedDecisions = completeMeeting.data?.suggestedDecisions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-amber-600" />
            Complete Meeting: {meetingTitle}
          </DialogTitle>
          <DialogDescription>
            Record decisions and create follow-up action items from this meeting.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="suggested">
              <Sparkles className="h-4 w-4 mr-2" />
              Suggested
            </TabsTrigger>
            <TabsTrigger value="decisions">
              <Gavel className="h-4 w-4 mr-2" />
              Decisions ({decisions.length})
            </TabsTrigger>
            <TabsTrigger value="actions">
              <ListTodo className="h-4 w-4 mr-2" />
              Action Items ({actionItems.length})
            </TabsTrigger>
          </TabsList>

          {/* Suggested Decisions Tab */}
          <TabsContent value="suggested" className="space-y-4">
            {!completeMeeting.data ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notes">Meeting Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Summarize key points discussed..."
                    rows={4}
                  />
                </div>

                <Button
                  onClick={handleCompleteMeeting}
                  disabled={completeMeeting.isPending}
                  className="w-full"
                >
                  {completeMeeting.isPending ? 'Completing...' : 'Complete Meeting & Get Suggestions'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Suggested Decisions Based on Agenda
                </div>

                {suggestedDecisions.length > 0 ? (
                  <div className="space-y-2">
                    {suggestedDecisions.map((suggestion, index) => {
                      const typeConfig = DECISION_TYPES.find(t => t.value === suggestion.decisionType);
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{typeConfig?.icon}</span>
                                <h4 className="font-medium text-sm">{suggestion.title}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {typeConfig?.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                From: {suggestion.agendaTitle}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDecisions([...decisions, {
                                  title: suggestion.title,
                                  description: suggestion.description,
                                  decisionType: suggestion.decisionType,
                                  impact: 'medium',
                                  createPolicy: false,
                                }]);
                                toast.success('Added to decisions');
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    No suggestions available. You can manually add decisions in the Decisions tab.
                  </div>
                )}

                <Button
                  variant="secondary"
                  onClick={() => setActiveTab('decisions')}
                  className="w-full"
                >
                  Continue to Decisions
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Decisions Tab */}
          <TabsContent value="decisions" className="space-y-4">
            {decisions.length > 0 && (
              <div className="space-y-2 mb-4">
                {decisions.map((decision, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{decision.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {DECISION_TYPES.find(t => t.value === decision.decisionType)?.label}
                          </Badge>
                          <Badge
                            variant={
                              decision.impact === 'high' ? 'destructive' :
                              decision.impact === 'medium' ? 'default' : 'secondary'
                            }
                            className="text-xs"
                          >
                            {decision.impact} impact
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{decision.description}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDecisions(decisions.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new decision */}
            <div className="p-4 border-2 border-dashed rounded-lg space-y-3 bg-muted/20">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4" />
                Add Decision
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="Decision title *"
                  value={newDecisionTitle}
                  onChange={(e) => setNewDecisionTitle(e.target.value)}
                />

                <Textarea
                  placeholder="Decision description *"
                  value={newDecisionDesc}
                  onChange={(e) => setNewDecisionDesc(e.target.value)}
                  rows={2}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Select value={newDecisionType} onValueChange={setNewDecisionType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISION_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Select value={newDecisionImpact} onValueChange={setNewDecisionImpact}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High Impact</SelectItem>
                        <SelectItem value="medium">Medium Impact</SelectItem>
                        <SelectItem value="low">Low Impact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addDecision}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Decision
                </Button>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => setActiveTab('actions')}
              className="w-full"
            >
              Continue to Action Items
            </Button>
          </TabsContent>

          {/* Action Items Tab */}
          <TabsContent value="actions" className="space-y-4">
            {actionItems.length > 0 && (
              <div className="space-y-2 mb-4">
                {actionItems.map((action, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{action.title}</h4>
                          <Badge
                            variant={
                              action.priority === 'urgent' ? 'destructive' :
                              action.priority === 'high' ? 'default' : 'secondary'
                            }
                            className="text-xs"
                          >
                            {action.priority}
                          </Badge>
                        </div>
                        {action.description && (
                          <p className="text-sm text-muted-foreground mb-1">{action.description}</p>
                        )}
                        {action.assignedTo && (
                          <p className="text-xs text-muted-foreground">
                            Assigned to: {action.assignedTo}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActionItems(actionItems.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new action item */}
            <div className="p-4 border-2 border-dashed rounded-lg space-y-3 bg-muted/20">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4" />
                Add Action Item
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="Action item title *"
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                />

                <Textarea
                  placeholder="Description (optional)"
                  value={newActionDesc}
                  onChange={(e) => setNewActionDesc(e.target.value)}
                  rows={2}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Assigned to"
                    value={newActionAssignee}
                    onChange={(e) => setNewActionAssignee(e.target.value)}
                  />

                  <Select value={newActionPriority} onValueChange={setNewActionPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addActionItem}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Action Item
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {decisions.length} decisions, {actionItems.length} action items
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFinalizeAndSave}
              disabled={decisions.length === 0 || createDecision.isPending || createActionItems.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {createDecision.isPending || createActionItems.isPending ? 'Saving...' : 'Finalize & Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
