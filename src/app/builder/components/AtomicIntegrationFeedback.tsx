"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  XCircle, 
  Zap, 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  Settings,
  Building2,
  Users,
  DollarSign,
  Target,
  Sparkles
} from 'lucide-react';
import type { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import type { AtomicIntegrationFeedback as FeedbackType } from '../utils/atomicGovernmentIntegration';
import { generateAtomicIntegrationFeedback } from '../utils/atomicGovernmentIntegration';
import type { EconomicInputs } from '../lib/economy-data-service';
import type { GovernmentBuilderState } from '~/types/government';

interface AtomicIntegrationFeedbackProps {
  selectedComponents: ComponentType[];
  currentGovernmentBuilder: GovernmentBuilderState | null;
  economicInputs: EconomicInputs;
  onUpdateGovernmentBuilder?: () => void;
  onAddComponents?: (components: ComponentType[]) => void;
  className?: string;
}

export function AtomicIntegrationFeedback({
  selectedComponents,
  currentGovernmentBuilder,
  economicInputs,
  onUpdateGovernmentBuilder,
  onAddComponents,
  className = ""
}: AtomicIntegrationFeedbackProps) {
  const [feedback, setFeedback] = useState<FeedbackType[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [synergyScore, setSynergyScore] = useState(0);
  const [conflictScore, setConflictScore] = useState(0);

  // Generate feedback when components change
  useEffect(() => {
    const newFeedback = generateAtomicIntegrationFeedback(
      selectedComponents,
      currentGovernmentBuilder,
      economicInputs
    );
    setFeedback(newFeedback);

    // Calculate synergy and conflict scores
    const synergies = newFeedback.filter(f => f.type === 'success');
    const conflicts = newFeedback.filter(f => f.type === 'warning');
    setSynergyScore(synergies.length);
    setConflictScore(conflicts.length);
  }, [selectedComponents, currentGovernmentBuilder, economicInputs]);

  const getFeedbackIcon = (type: FeedbackType['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getFeedbackColor = (type: FeedbackType['type']) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getImpactColor = (impact: FeedbackType['impact']) => {
    switch (impact) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const handleFeedbackAction = (feedbackItem: FeedbackType) => {
    if (feedbackItem.actionLabel === 'Update Government Builder' && onUpdateGovernmentBuilder) {
      onUpdateGovernmentBuilder();
    } else if (feedbackItem.actionLabel === 'Add Components' && onAddComponents) {
      // Extract suggested components from message
      const suggestedComponents = feedbackItem.message
        .split('Consider adding: ')[1]
        ?.split(' for better governance')[0]
        ?.split(', ') as ComponentType[];
      
      if (suggestedComponents) {
        onAddComponents(suggestedComponents);
      }
    }
  };

  const overallHealth = synergyScore > conflictScore ? 'excellent' : 
                       synergyScore === conflictScore ? 'good' : 
                       conflictScore > synergyScore * 2 ? 'critical' : 'concerning';

  const healthColor = overallHealth === 'excellent' ? 'text-green-600' :
                     overallHealth === 'good' ? 'text-blue-600' :
                     overallHealth === 'concerning' ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card className={`border-l-4 border-l-blue-500 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Atomic Integration Status</CardTitle>
              <p className="text-sm text-muted-foreground">
                Real-time feedback on your government components
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-700"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>

        {/* Health Overview */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Health</span>
            <Badge variant="outline" className={`${healthColor} border-current`}>
              {overallHealth.charAt(0).toUpperCase() + overallHealth.slice(1)}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-600">Synergies</span>
                <span className="text-xs font-medium">{synergyScore}</span>
              </div>
              <Progress value={Math.min(synergyScore * 20, 100)} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-red-600">Conflicts</span>
                <span className="text-xs font-medium">{conflictScore}</span>
              </div>
              <Progress value={Math.min(conflictScore * 20, 100)} className="h-2" />
            </div>
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent className="pt-0 space-y-4">
              {/* Feedback Items */}
              <div className="space-y-3">
                {feedback.length === 0 ? (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Select atomic components to see integration feedback and recommendations.
                    </AlertDescription>
                  </Alert>
                ) : (
                  feedback.map((feedbackItem, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Alert className={`border ${getFeedbackColor(feedbackItem.type)}`}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getFeedbackIcon(feedbackItem.type)}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <AlertDescription className="font-medium">
                                {feedbackItem.title}
                              </AlertDescription>
                              <div className={`w-2 h-2 rounded-full ${getImpactColor(feedbackItem.impact)}`} />
                            </div>
                            <AlertDescription className="text-sm">
                              {feedbackItem.message}
                            </AlertDescription>
                            {feedbackItem.actionable && feedbackItem.actionLabel && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleFeedbackAction(feedbackItem)}
                                className="mt-2"
                              >
                                {feedbackItem.actionLabel}
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Alert>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Component Statistics */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center space-y-1">
                  <div className="text-lg font-bold text-blue-600">{selectedComponents.length}</div>
                  <div className="text-xs text-muted-foreground">Components</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-lg font-bold text-green-600">{synergyScore}</div>
                  <div className="text-xs text-muted-foreground">Synergies</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-lg font-bold text-red-600">{conflictScore}</div>
                  <div className="text-xs text-muted-foreground">Conflicts</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onUpdateGovernmentBuilder}
                  disabled={!currentGovernmentBuilder}
                  className="flex-1"
                >
                  <Building2 className="h-3 w-3 mr-1" />
                  Update Builder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsExpanded(false)}
                  className="flex-1"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Configure
                </Button>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/**
 * Compact version for inline use
 */
export function AtomicIntegrationFeedbackInline({
  selectedComponents,
  currentGovernmentBuilder,
  economicInputs,
  onUpdateGovernmentBuilder,
  className = ""
}: Omit<AtomicIntegrationFeedbackProps, 'isExpanded' | 'onAddComponents'>) {
  const [feedback, setFeedback] = useState<FeedbackType[]>([]);

  useEffect(() => {
    const newFeedback = generateAtomicIntegrationFeedback(
      selectedComponents,
      currentGovernmentBuilder,
      economicInputs
    );
    setFeedback(newFeedback);
  }, [selectedComponents, currentGovernmentBuilder, economicInputs]);

  const criticalIssues = feedback.filter(f => f.impact === 'critical');
  const hasWarnings = feedback.some(f => f.type === 'warning' || f.type === 'error');

  if (feedback.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {criticalIssues.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {criticalIssues.length} critical issue{criticalIssues.length > 1 ? 's' : ''} detected. 
            <Button
              variant="link"
              size="sm"
              onClick={onUpdateGovernmentBuilder}
              className="p-0 h-auto text-red-800 underline ml-1"
            >
              Review components
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {!criticalIssues.length && hasWarnings && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Some components may conflict. 
            <Button
              variant="link"
              size="sm"
              onClick={onUpdateGovernmentBuilder}
              className="p-0 h-auto text-yellow-800 underline ml-1"
            >
              Review recommendations
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
