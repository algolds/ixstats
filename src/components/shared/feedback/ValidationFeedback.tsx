"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export interface ValidationMessage {
  field?: string;
  message: string;
  severity: "error" | "warning" | "info" | "success";
}

export interface ValidationFeedbackProps {
  messages: ValidationMessage[];
  onDismiss?: (index: number) => void;
  className?: string;
  grouped?: boolean;
  compact?: boolean;
}

const severityConfig = {
  error: {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/5 border-red-500/20",
    badge: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/5 border-yellow-500/20",
    badge: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  },
  info: {
    icon: Info,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/5 border-blue-500/20",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  success: {
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-500/5 border-green-500/20",
    badge: "bg-green-500/10 text-green-700 dark:text-green-400",
  },
};

export function ValidationFeedback({
  messages,
  onDismiss,
  className,
  grouped = false,
  compact = false,
}: ValidationFeedbackProps) {
  if (messages.length === 0) return null;

  if (grouped) {
    const groupedMessages = messages.reduce(
      (acc, msg) => {
        if (!acc[msg.severity]) acc[msg.severity] = [];
        acc[msg.severity]!.push(msg);
        return acc;
      },
      {} as Record<string, ValidationMessage[]>
    );

    return (
      <div className={cn("space-y-2", className)}>
        <AnimatePresence>
          {Object.entries(groupedMessages).map(([severity, msgs]) => {
            const config = severityConfig[severity as keyof typeof severityConfig];
            const Icon = config.icon;

            return (
              <motion.div
                key={severity}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Alert className={cn("px-4 py-3", config.bg)}>
                  <div className="flex items-start gap-2">
                    <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", config.color)} />
                    <div className="flex-1 space-y-1">
                      <AlertDescription>
                        <div className="space-y-1">
                          {msgs.map((msg, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              {msg.field && (
                                <Badge variant="outline" className={cn("text-xs", config.badge)}>
                                  {msg.field}
                                </Badge>
                              )}
                              <span className="text-sm">{msg.message}</span>
                            </div>
                          ))}
                        </div>
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }

  // Individual messages
  return (
    <div className={cn("space-y-2", className)}>
      <AnimatePresence>
        {messages.map((msg, index) => {
          const config = severityConfig[msg.severity];
          const Icon = config.icon;

          if (compact) {
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 text-sm"
              >
                <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", config.color)} />
                {msg.field && (
                  <Badge variant="outline" className={cn("text-xs", config.badge)}>
                    {msg.field}
                  </Badge>
                )}
                <span className="flex-1">{msg.message}</span>
                {onDismiss && (
                  <button
                    onClick={() => onDismiss(index)}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </motion.div>
            );
          }

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Alert className={cn("px-3 py-2", config.bg)}>
                <div className="flex items-start gap-2">
                  <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", config.color)} />
                  <div className="flex-1">
                    <AlertDescription>
                      <div className="flex items-start gap-2">
                        {msg.field && (
                          <Badge variant="outline" className={cn("text-xs", config.badge)}>
                            {msg.field}
                          </Badge>
                        )}
                        <span className="text-sm">{msg.message}</span>
                      </div>
                    </AlertDescription>
                  </div>
                  {onDismiss && (
                    <button
                      onClick={() => onDismiss(index)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </Alert>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// Summary component
export function ValidationSummary({
  messages,
  className,
}: {
  messages: ValidationMessage[];
  className?: string;
}) {
  const counts = messages.reduce(
    (acc, msg) => {
      acc[msg.severity]++;
      return acc;
    },
    { error: 0, warning: 0, info: 0, success: 0 }
  );

  if (messages.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {counts.error > 0 && (
        <Badge variant="destructive" className="text-xs">
          {counts.error} Error{counts.error > 1 ? "s" : ""}
        </Badge>
      )}
      {counts.warning > 0 && (
        <Badge className="border-yellow-500/20 bg-yellow-500/10 text-xs text-yellow-700 dark:text-yellow-400">
          {counts.warning} Warning{counts.warning > 1 ? "s" : ""}
        </Badge>
      )}
      {counts.info > 0 && (
        <Badge className="border-blue-500/20 bg-blue-500/10 text-xs text-blue-700 dark:text-blue-400">
          {counts.info} Info
        </Badge>
      )}
      {counts.success > 0 && (
        <Badge className="border-green-500/20 bg-green-500/10 text-xs text-green-700 dark:text-green-400">
          {counts.success} Success
        </Badge>
      )}
    </div>
  );
}
