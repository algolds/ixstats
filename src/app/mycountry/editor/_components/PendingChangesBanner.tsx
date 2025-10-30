"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

interface PendingChangesBannerProps {
  changeCount: number;
  onReview: () => void;
}

export function PendingChangesBanner({ changeCount, onReview }: PendingChangesBannerProps) {
  if (changeCount === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardContent className="flex items-center justify-between py-3">
        <div className="text-sm text-amber-800 dark:text-amber-200">
          {changeCount} change{changeCount !== 1 ? "s" : ""} pending application. Affected values
          are locked until applied.
        </div>
        <Button variant="outline" size="sm" onClick={onReview}>
          Review
        </Button>
      </CardContent>
    </Card>
  );
}
