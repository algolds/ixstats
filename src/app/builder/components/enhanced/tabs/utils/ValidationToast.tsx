"use client";

import React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ValidationMessage } from "~/components/shared/feedback/ValidationFeedback";
import { scrollToField } from "./validation";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";

interface ValidationToastProps {
  messages: ValidationMessage[];
  className?: string;
}

export function ValidationToast({ messages, className }: ValidationToastProps) {
  const [mounted, setMounted] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
    const checkMediaQuery = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkMediaQuery();
    window.addEventListener("resize", checkMediaQuery);
    return () => window.removeEventListener("resize", checkMediaQuery);
  }, []);

  if (!mounted) return null;

  const targetId = isDesktop ? "right-sidebar-portal" : "right-sidebar-portal-mobile";
  const targetEl = document.getElementById(targetId);
  if (!targetEl) return null;

  const errorMessages = messages.filter((m) => m.severity === "error");
  const warningMessages = messages.filter((m) => m.severity === "warning");
  const infoMessages = messages.filter((m) => m.severity === "info");

  const errorCount = errorMessages.length;
  const warningCount = warningMessages.length;
  const infoCount = infoMessages.length;
  const totalCount = messages.length;

  const handleMessageClick = (msg: ValidationMessage) => {
    if (msg.field) {
      scrollToField(msg.field);
    }
  };

  // Determine card styling based on severity status
  let cardTheme: "red" | "gold" | "emerald" | "neutral" = "neutral";
  let statusTitle = "System Status";
  let statusDescription = "Parameters check in progress...";
  let statusColor = "text-zinc-400";
  let StatusIcon = Info;

  if (errorCount > 0) {
    cardTheme = "red";
    statusTitle = "System Error";
    statusDescription = `${errorCount} critical configuration issue${errorCount === 1 ? "" : "s"} must be resolved.`;
    statusColor = "text-red-400";
    StatusIcon = AlertCircle;
  } else if (warningCount > 0) {
    cardTheme = "gold";
    statusTitle = "System Warnings";
    statusDescription = `${warningCount} parameter warning${warningCount === 1 ? "" : "s"} should be reviewed.`;
    statusColor = "text-amber-400";
    StatusIcon = AlertTriangle;
  } else if (totalCount > 0) {
    cardTheme = "neutral";
    statusTitle = "System Notice";
    statusDescription = `${infoCount} active status detail${infoCount === 1 ? "" : "s"}.`;
    statusColor = "text-blue-400";
    StatusIcon = Info;
  } else {
    cardTheme = "emerald";
    statusTitle = "System Balanced";
    statusDescription = "All parameters are within normal operating bounds. Contributions and distributions are fully stable.";
    statusColor = "text-emerald-400";
    StatusIcon = CheckCircle2;
  }

  return createPortal(
    <div className={cn("w-full space-y-4", className)}>
      <GlassCard
        theme={cardTheme}
        depth="base"
        className="w-full border-zinc-800/80 shadow-md backdrop-blur-md"
        texture="dots"
        textureOpacity={0.05}
      >
        {/* Header */}
        <div className="border-border/40 border-b bg-white/[0.02] px-4 py-3 flex items-center gap-2.5">
          <StatusIcon className={cn("h-4.5 w-4.5 shrink-0", statusColor)} />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
              {statusTitle}
            </h4>
          </div>
          {totalCount > 0 && (
            <span className={cn(
              "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white",
              errorCount > 0 ? "bg-red-500" : "bg-amber-500"
            )}>
              {totalCount}
            </span>
          )}
        </div>

        <GlassCardContent className="p-4 space-y-3">
          <p className="text-[11px] leading-relaxed text-zinc-400">
            {statusDescription}
          </p>

          {/* List of issues */}
          {totalCount > 0 && (
            <div className="space-y-3 pt-2 border-t border-zinc-800/50 max-h-[350px] overflow-y-auto pr-1">
              {errorCount > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-red-500/85 uppercase tracking-wider mb-1">
                    Errors ({errorCount})
                  </div>
                  {errorMessages.map((msg, idx) => (
                    <button
                      key={`err-${idx}`}
                      onClick={() => handleMessageClick(msg)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                        "bg-red-500/10 border border-red-500/15 text-red-400 hover:bg-red-500/15 cursor-pointer"
                      )}
                    >
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 leading-tight">{msg.message}</span>
                    </button>
                  ))}
                </div>
              )}

              {warningCount > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-[9px] font-bold text-amber-500/85 uppercase tracking-wider mb-1">
                    Warnings ({warningCount})
                  </div>
                  {warningMessages.map((msg, idx) => (
                    <button
                      key={`warn-${idx}`}
                      onClick={() => handleMessageClick(msg)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                        "bg-amber-500/10 border border-amber-500/15 text-amber-400 hover:bg-amber-500/15 cursor-pointer"
                      )}
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 leading-tight">{msg.message}</span>
                    </button>
                  ))}
                </div>
              )}

              {infoCount > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-[9px] font-bold text-blue-500/85 uppercase tracking-wider mb-1">
                    Information ({infoCount})
                  </div>
                  {infoMessages.map((msg, idx) => (
                    <button
                      key={`info-${idx}`}
                      onClick={() => handleMessageClick(msg)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                        "bg-blue-500/10 border border-blue-500/15 text-blue-400 hover:bg-blue-500/15 cursor-pointer"
                      )}
                    >
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 leading-tight">{msg.message}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </div>,
    targetEl
  );
}
