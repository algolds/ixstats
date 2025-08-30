"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Activity,
  Target
} from "lucide-react";

interface FeedbackMetric {
  label: string;
  value: number;
  change?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'danger';
  unit?: string;
}

interface RealTimeFeedbackDisplayProps {
  feedback: { sections: { title: string; metrics: FeedbackMetric[]; }[]; overallScore: number; recommendations: string[]; } | null;
  realTimeValidation: boolean;
}

export function RealTimeFeedbackDisplay({ feedback, realTimeValidation }: RealTimeFeedbackDisplayProps) {
  if (!realTimeValidation || !feedback) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {feedback.sections.map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={''}
          >
            <Card className="glass-hierarchy-child border-blue-200/50 dark:border-blue-700/50 bg-gradient-to-br from-blue-50/30 to-indigo-50/30 dark:from-blue-950/10 dark:to-indigo-950/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-sm">{section.title}</h3>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    <Target className="h-3 w-3 mr-1" />
                    LIVE
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {section.metrics.map((metric, index) => (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {metric.status === 'good' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {metric.status === 'warning' && (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        {metric.status === 'danger' && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {metric.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <NumberFlowDisplay
                          value={metric.value}
                          format={
                            metric.unit === '%' ? 'percentage' :
                            metric.unit === '$' ? 'financial' :
                            metric.unit === ' years' ? 'decimal' :
                            metric.label.toLowerCase().includes('population') ? 'population' :
                            metric.label.toLowerCase().includes('gdp') ? 'financial' :
                            'default'
                          }
                          suffix={metric.unit && !['%', '$'].includes(metric.unit) ? metric.unit : ''}
                          className="text-sm font-mono"
                          trend={metric.trend}
                          duration={600}
                          decimalPlaces={
                            metric.unit === '%' ? 1 :
                            metric.unit === '$' ? 0 :
                            metric.unit === ' years' ? 1 :
                            0
                          }
                        />
                        
                        {metric.change !== undefined && (
                          <div className="flex items-center gap-1">
                            {metric.trend === 'up' && (
                              <TrendingUp className="h-3 w-3 text-green-500" />
                            )}
                            {metric.trend === 'down' && (
                              <TrendingDown className="h-3 w-3 text-red-500" />
                            )}
                            <span className={`text-xs ${
                              metric.trend === 'up' ? 'text-green-500' : 
                              metric.trend === 'down' ? 'text-red-500' : 
                              'text-gray-500'
                            }`}>
                              {metric.change > 0 ? '+' : ''}
                              <NumberFlowDisplay
                                value={metric.change}
                                format={
                                  metric.unit === '%' ? 'percentage' :
                                  metric.unit === '$' ? 'financial' :
                                  'default'
                                }
                                duration={400}
                                decimalPlaces={
                                  metric.unit === '%' ? 1 :
                                  metric.unit === '$' ? 0 :
                                  2
                                }
                              />
                              {metric.changePercent && (
                                <>
                                  {' '}(
                                  <NumberFlowDisplay
                                    value={metric.changePercent}
                                    format="percentage"
                                    duration={400}
                                    decimalPlaces={1}
                                  />
                                  )
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      
      {/* Overall Score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-4"
      >
        <Card className="glass-hierarchy-child border-green-200/50 dark:border-green-700/50 bg-gradient-to-r from-green-50/30 to-emerald-50/30 dark:from-green-950/10 dark:to-emerald-950/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-green-600" />
                <span className="font-semibold">Overall Economic Health</span>
              </div>
              <div className="flex items-center gap-2">
                <NumberFlowDisplay
                  value={feedback.overallScore}
                  format="percentage"
                  className={`text-lg font-bold ${
                    feedback.overallScore >= 80 ? 'text-green-600' :
                    feedback.overallScore >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}
                  duration={800}
                />
                <Badge variant={feedback.overallScore >= 80 ? 'default' : feedback.overallScore >= 60 ? 'secondary' : 'destructive'}>
                  {feedback.overallScore >= 80 ? 'Excellent' :
                   feedback.overallScore >= 60 ? 'Good' : 'Needs Attention'}
                </Badge>
              </div>
            </div>
            
            {feedback.recommendations.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">Recommendations:</p>
                <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  {feedback.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">▪</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}