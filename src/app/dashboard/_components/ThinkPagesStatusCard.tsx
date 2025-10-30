"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import {
  Users,
  FileText,
  TrendingUp,
  Clock,
  ChevronRight,
  Zap,
  Brain,
  BookOpen,
  Lightbulb,
} from "lucide-react";

interface ThinkPagesStatusCardProps {
  userProfile?: any;
  className?: string;
  onCollapse?: () => void;
}

export function ThinkPagesStatusCard({
  userProfile,
  className = "",
  onCollapse,
}: ThinkPagesStatusCardProps) {
  // ThinkPages feature is in preview - APIs not yet available
  // Show "Coming Soon" state instead of mock data
  const isComingSoon = true;

  function getRelativeTime(date: Date | string): string {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "just now";
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return then.toLocaleDateString();
  }

  return (
    <div className={className}>
      <Card className="glass-hierarchy-child h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Brain className="h-5 w-5 text-blue-500" />
              ThinkPages
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Preview
              </Badge>
              {onCollapse && (
                <button
                  className="glass-hierarchy-interactive rounded p-1 transition-transform hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCollapse();
                  }}
                >
                  <ChevronRight className="text-foreground h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isComingSoon ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-blue-500/10 p-4">
                <Lightbulb className="h-12 w-12 text-blue-500" />
              </div>
              <h4 className="mb-2 text-lg font-semibold">Coming Soon</h4>
              <p className="text-muted-foreground mb-6 max-w-md text-sm">
                ThinkPages is currently in preview. Full integration with collaborative research,
                think tanks, and academic exchanges will be available soon.
              </p>
              <Badge variant="outline" className="text-xs">
                <Zap className="mr-1 h-3 w-3" />
                In Development
              </Badge>
            </div>
          ) : (
            <>
              {/* This section will be enabled when APIs are available */}
              <div className="text-muted-foreground text-center text-sm">No data available</div>
            </>
          )}

          {/* Action Button - Always show */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
            <Link
              href="/thinkpages"
              className="glass-hierarchy-interactive hover:bg-accent/10 group flex w-full items-center justify-between rounded-lg p-3 transition-colors"
            >
              <span className="text-sm font-medium">Open ThinkPages</span>
              <ChevronRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
            </Link>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
