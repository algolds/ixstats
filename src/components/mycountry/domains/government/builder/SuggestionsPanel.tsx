"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { AlertTriangle, Lightbulb } from "lucide-react";

export interface SuggestionItem<T = any> {
  id: string;
  title: string;
  description?: string;
  severity: "info" | "warning" | "critical";
  diff?: string;
  payload?: T;
  action?: () => void;
}

interface SuggestionsPanelProps<T = any> {
  suggestions: SuggestionItem<T>[];
  onApply: (suggestion: SuggestionItem<T>) => void;
  onDismiss?: (id: string) => void;
  isReadOnly?: boolean;
}

export function SuggestionsPanel<T = any>({
  suggestions,
  onApply,
  onDismiss,
  isReadOnly = false,
}: SuggestionsPanelProps<T>) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5" />
          Intelligent Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {s.severity !== "info" && (
                  <AlertTriangle
                    className={`h-4 w-4 ${s.severity === "critical" ? "text-red-600" : "text-yellow-600"}`}
                  />
                )}
                <div className="font-medium">{s.title}</div>
              </div>
              {s.description && (
                <div className="text-muted-foreground text-sm">{s.description}</div>
              )}
              {s.diff && (
                <pre className="bg-muted max-h-40 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap">
                  {s.diff}
                </pre>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!isReadOnly && (
                <Button size="sm" onClick={() => onApply(s)}>
                  Apply
                </Button>
              )}
              {onDismiss && (
                <Button size="sm" variant="outline" onClick={() => onDismiss(s.id)}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
