"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ValidationMessage } from "~/components/shared/feedback/ValidationFeedback";
import { scrollToField } from "./validation";

interface ValidationToastProps {
  messages: ValidationMessage[];
  className?: string;
}

const severityIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const severityColor: Record<string, string> = {
  error: "text-red-500",
  warning: "text-yellow-500",
  info: "text-blue-500",
  success: "text-green-500",
};

const severityBg: Record<string, string> = {
  error: "bg-red-500/10 border-red-500/20",
  warning: "bg-yellow-500/10 border-yellow-500/20",
  info: "bg-blue-500/10 border-blue-500/20",
  success: "bg-green-500/10 border-green-500/20",
};

export function ValidationToast({ messages, className }: ValidationToastProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setExpanded(true);
    window.addEventListener("ix:open-validation-toast", handler);
    return () => window.removeEventListener("ix:open-validation-toast", handler);
  }, []);

  React.useEffect(() => {
    if (messages.length === 0) {
      setExpanded(false);
      setDismissed(false);
    }
  }, [messages.length]);

  if (messages.length === 0 || dismissed) return null;

  const errorCount = messages.filter((m) => m.severity === "error").length;
  const warningCount = messages.filter((m) => m.severity === "warning").length;
  const infoCount = messages.filter((m) => m.severity === "info").length;
  const totalCount = messages.length;

  const icon = errorCount > 0
    ? severityIcon.error
    : warningCount > 0
      ? severityIcon.warning
      : severityIcon.info;

  const iconColor = errorCount > 0
    ? severityColor.error
    : warningCount > 0
      ? severityColor.warning
      : severityColor.info;

  const Icon = icon;

  const handleClick = () => {
    setExpanded(!expanded);
  };

  const handleMessageClick = (msg: ValidationMessage) => {
    if (msg.field) {
      scrollToField(msg.field);
    }
  };

  const severityOrder: Array<{ key: string; label: string; severity: ValidationMessage["severity"] }> = [];
  if (errorCount > 0) severityOrder.push({ key: "error", label: `${errorCount} error${errorCount === 1 ? "" : "s"}`, severity: "error" });
  if (warningCount > 0) severityOrder.push({ key: "warning", label: `${warningCount} warning${warningCount === 1 ? "" : "s"}`, severity: "warning" });
  if (infoCount > 0) severityOrder.push({ key: "info", label: `${infoCount} info`, severity: "info" });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "fixed bottom-4 right-4 z-50 max-w-sm",
          className
        )}
      >
        {/* Collapsed badge */}
        <motion.button
          onClick={handleClick}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2 shadow-lg backdrop-blur-md",
            errorCount > 0
              ? "border-red-500/30 bg-red-500/10 text-red-600 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-400"
              : warningCount > 0
                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:border-yellow-500/40 dark:bg-yellow-500/15 dark:text-yellow-400"
                : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-400"
          )}
        >
          {totalCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-current text-[10px] font-bold text-white">
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          )}
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium">
            {severityOrder.map((s, i) => (
              <span key={s.key}>
                {i > 0 && ", "}
                {s.label}
              </span>
            ))}
          </span>
        </motion.button>

        {/* Expanded panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl"
            >
              <div className={cn(
                "max-h-80 space-y-1 overflow-y-auto p-3",
                errorCount > 0
                  ? "border-red-500/20 bg-red-500/5"
                  : warningCount > 0
                    ? "border-yellow-500/20 bg-yellow-500/5"
                    : "border-blue-500/20 bg-blue-500/5"
              )}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Validation Issues
                  </span>
                  <button
                    onClick={() => { setExpanded(false); setDismissed(true); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {severityOrder.map(({ severity }) => {
                  const sevMsgs = messages.filter((m) => m.severity === severity);
                  const SevIcon = severityIcon[severity];
                  return sevMsgs.map((msg, idx) => (
                    <button
                      key={`${severity}-${idx}`}
                      onClick={() => handleMessageClick(msg)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        severityColor[severity],
                        severityBg[severity],
                        "hover:opacity-80 cursor-pointer"
                      )}
                    >
                      <SevIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="flex-1 leading-tight">{msg.message}</span>
                    </button>
                  ));
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
