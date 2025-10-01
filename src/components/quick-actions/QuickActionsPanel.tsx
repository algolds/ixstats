"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { api } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { NumberFlowDisplay } from '~/components/ui/number-flow';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Zap,
  TrendingUp,
  Shield,
  Users,
  Building2,
  Handshake,
  Clock,
  CheckCircle,
  AlertTriangle,
  Target,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: 'urgent' | 'important' | 'routine' | 'future';
  estimatedDuration: string;
  successProbability: number;
  estimatedBenefit: string;
  actionType: string;
}

const urgencyConfig = {
  urgent: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertTriangle },
  important: { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: Clock },
  routine: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Activity },
  future: { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: Target }
};

const categoryIcons = {
  economic: TrendingUp,
  security: Shield,
  social: Users,
  infrastructure: Building2,
  diplomatic: Handshake
};

interface QuickActionsPanelProps {
  className?: string;
}

export function QuickActionsPanel({ className }: QuickActionsPanelProps) {
  const { user } = useUser();
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch quick actions
  const { data: quickActions, isLoading, refetch } = api.eci.getQuickActions.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id, refetchInterval: 60000 } // Refetch every minute
  );

  // Execute quick action mutation
  const executeAction = api.eci.executeQuickAction.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      if (result.effect) {
        toast.info(`Effect: ${result.effect}`, { duration: 5000 });
      }
      void refetch();
      setShowConfirmDialog(false);
      setSelectedAction(null);
    },
    onError: (error) => {
      toast.error(`Failed to execute action: ${error.message}`);
      setShowConfirmDialog(false);
    }
  });

  // Apply policy effects mutation  
  const applyPolicyEffects = api.eci.applyPolicyEffects.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to apply policy effects: ${error.message}`);
    }
  });

  const handleActionClick = (action: QuickAction) => {
    setSelectedAction(action);
    setShowConfirmDialog(true);
  };

  const confirmExecuteAction = () => {
    if (selectedAction && user?.id) {
      executeAction.mutate({
        userId: user.id,
        actionType: selectedAction.actionType,
        parameters: {}
      });
    }
  };

  const handleApplyPolicyEffects = () => {
    if (user?.id) {
      applyPolicyEffects.mutate({ userId: user.id });
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card className="glass-hierarchy-parent">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              Quick Actions
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {quickActions?.length || 0} Available
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyPolicyEffects}
                disabled={applyPolicyEffects.isPending}
              >
                {applyPolicyEffects.isPending ? 'Applying...' : 'Apply Policy Effects'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {quickActions && quickActions.length > 0 ? (
            quickActions.map((action: any, index: number) => {
              const urgencyConf = urgencyConfig[action.urgency as keyof typeof urgencyConfig] || urgencyConfig.routine;
              const UrgencyIcon = urgencyConf.icon;
              const CategoryIcon = categoryIcons[action.category as keyof typeof categoryIcons] || Activity;

              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${urgencyConf.bg}`}
                  onClick={() => handleActionClick(action)}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-white/80 border border-border/50">
                      <CategoryIcon className={`h-5 w-5 ${urgencyConf.color}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-sm">{action.title}</h3>
                        <div className="flex items-center gap-1">
                          <UrgencyIcon className={`h-3 w-3 ${urgencyConf.color}`} />
                          <Badge variant="outline" className="text-xs capitalize">
                            {action.urgency}
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {action.description}
                      </p>
                      
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Duration:</span>
                          <div className="font-medium">{action.estimatedDuration}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Success:</span>
                          <div className="font-medium flex items-center gap-1">
                            <NumberFlowDisplay 
                              value={action.successProbability}
                              decimalPlaces={0}
                              className="inline"
                            />%
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Benefit:</span>
                          <div className="font-medium text-green-600">{action.estimatedBenefit}</div>
                        </div>
                      </div>
                      
                      {action.successProbability && (
                        <div className="mt-3">
                          <Progress value={action.successProbability} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No quick actions available</p>
              <p className="text-sm">Actions will appear based on your country's current state</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              Execute Quick Action
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to execute this action? This will have real effects on your country's statistics.
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">{selectedAction.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{selectedAction.description}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <div className="font-medium">{selectedAction.estimatedDuration}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Success Rate:</span>
                    <div className="font-medium">
                      <NumberFlowDisplay 
                        value={selectedAction.successProbability}
                        decimalPlaces={0}
                        className="inline"
                      />%
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Expected Benefit:</span>
                    <div className="font-medium text-green-600">{selectedAction.estimatedBenefit}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmExecuteAction}
              disabled={executeAction.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {executeAction.isPending ? 'Executing...' : 'Execute Action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}