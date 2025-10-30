/**
 * Comparative Benchmarking Card Component
 *
 * Displays comparative performance metrics vs peer countries.
 *
 * @module ComparativeBenchmarkingCard
 */

import React from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import type { ComparativeBenchmark } from "~/lib/analytics-data-transformers";

interface ComparativeBenchmarkingCardProps {
  data: ComparativeBenchmark[];
}

export const ComparativeBenchmarkingCard = React.memo<ComparativeBenchmarkingCardProps>(
  ({ data }) => {
    return (
      <Card className="glass-surface glass-refraction">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Comparative Benchmarking
          </CardTitle>
          <CardDescription>Performance vs peer countries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.map((item, index) => (
              <div key={item.metric} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.metric}</span>
                  <span className="text-muted-foreground">vs Peer Average</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={{ delay: index * 0.1, duration: 0.5 }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-medium">{item.value}%</span>
                </div>
                <div className="flex items-center gap-2 opacity-60">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <motion.div
                      className="h-full bg-gray-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.peer}%` }}
                      transition={{ delay: index * 0.1, duration: 0.5 }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs font-medium">{item.peer}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
);

ComparativeBenchmarkingCard.displayName = "ComparativeBenchmarkingCard";
