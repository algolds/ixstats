import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ChevronDown, Eye, Zap, Clock, Play } from "lucide-react";
import { briefingTypeConfig } from "../_config/intelligence-config";
import type { IntelligenceBriefing } from "../_config/types";
import type { ActionableRecommendation } from "../../types/intelligence";

interface BriefingCardProps {
  briefing: IntelligenceBriefing;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRecommendationAction: (rec: ActionableRecommendation) => void;
}

export function BriefingCard({
  briefing,
  isExpanded,
  onToggleExpand,
  onRecommendationAction,
}: BriefingCardProps) {
  const typeConfig = briefingTypeConfig[briefing.type];
  const TypeIcon = typeConfig.icon;

  return (
    <Card className="glass-surface glass-refraction">
      <CardHeader
        className="hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded p-2 ${typeConfig.bg}`}>
              <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg">{briefing.title}</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">{briefing.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{briefing.confidence.toFixed(2)}%</Badge>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="text-muted-foreground h-5 w-5" />
            </motion.div>
          </div>
        </div>

        <div className="text-muted-foreground mt-3 flex items-center gap-3 text-xs">
          <Badge variant="secondary" className="text-xs">
            {typeConfig.label}
          </Badge>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {briefing.urgency}
          </span>
          <span>•</span>
          <span>Impact: {briefing.impact.magnitude}</span>
          <span>•</span>
          <span>{briefing.recommendations.length} actions</span>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent className="space-y-4 pt-0">
              {/* Evidence */}
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-semibold">
                  <Eye className="h-4 w-4" />
                  Evidence & Analysis
                </h4>
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Key Metrics</p>
                    <ul className="space-y-1">
                      {briefing.evidence.metrics.map((metric, i) => (
                        <li key={i} className="text-xs">
                          • {metric}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Trends</p>
                    <ul className="space-y-1">
                      {briefing.evidence.trends.map((trend, i) => (
                        <li key={i} className="text-xs">
                          • {trend}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Comparisons</p>
                    <ul className="space-y-1">
                      {briefing.evidence.comparisons.map((comp, i) => (
                        <li key={i} className="text-xs">
                          • {comp}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Recommended Actions */}
              {briefing.recommendations.length > 0 && (
                <div>
                  <h4 className="mb-3 flex items-center gap-2 font-semibold">
                    <Zap className="h-4 w-4" />
                    Recommended Actions
                  </h4>
                  <div className="space-y-2">
                    {briefing.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <h5 className="text-sm font-medium">{rec.title}</h5>
                              <Badge variant="outline" className="text-xs">
                                {rec.urgency}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mb-2 text-xs">{rec.description}</p>
                            <div className="text-muted-foreground flex items-center gap-3 text-xs">
                              <span>Duration: {rec.estimatedDuration}</span>
                              <span>•</span>
                              <span>Success: {rec.successProbability}%</span>
                              <span>•</span>
                              <span>Difficulty: {rec.difficulty}</span>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => onRecommendationAction(rec)}>
                            <Play className="mr-1 h-3 w-3" />
                            Take Action
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
