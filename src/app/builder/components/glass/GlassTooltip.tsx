"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";
import { Info, TrendingUp, TrendingDown, AlertTriangle, HelpCircle } from "lucide-react";

interface GlassTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  title?: string;
  impact?: {
    metric: string;
    change: number;
    description: string;
  }[];
  warning?: string;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  maxWidth?: string;
  className?: string;
  theme?: "gold" | "blue" | "indigo" | "red" | "neutral";
  zIndex?: number;
}

const themeStyles = {
  gold: "border-amber-300/30 text-amber-800 dark:text-amber-100",
  blue: "border-blue-300/30 text-blue-800 dark:text-blue-100",
  indigo: "border-indigo-300/30 text-indigo-800 dark:text-indigo-100",
  red: "border-red-300/30 text-red-800 dark:text-red-100",
  neutral: "border-gray-300/30 text-gray-800 dark:text-gray-100",
};

export function GlassTooltip({
  children,
  content,
  title,
  impact,
  warning,
  position = "top",
  delay = 500,
  maxWidth = "max-w-xs",
  className,
  theme = "neutral",
  zIndex = 9999,
}: GlassTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate position
  const calculatePosition = (triggerRect: DOMRect) => {
    const tooltipElement = tooltipRef.current;
    if (!tooltipElement) return;

    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let x = 0;
    let y = 0;

    switch (position) {
      case "top":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - 8;
        break;
      case "bottom":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + 8;
        break;
      case "left":
        x = triggerRect.left - tooltipRect.width - 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case "right":
        x = triggerRect.right + 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Constrain to viewport
    x = Math.max(8, Math.min(x, viewport.width - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, viewport.height - tooltipRect.height - 8));

    setCoordinates({ x, y });
  };

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Calculate position after tooltip is rendered
      requestAnimationFrame(() => {
        if (triggerRef.current) {
          calculatePosition(triggerRef.current.getBoundingClientRect());
        }
      });
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getArrowClasses = () => {
    const baseArrow =
      "absolute w-3 h-3 transform rotate-45 bg-white/90 dark:bg-black/80 border border-slate-200/50 dark:border-white/20";

    switch (position) {
      case "top":
        return `${baseArrow} -bottom-1.5 left-1/2 -translate-x-1/2`;
      case "bottom":
        return `${baseArrow} -top-1.5 left-1/2 -translate-x-1/2`;
      case "left":
        return `${baseArrow} -right-1.5 top-1/2 -translate-y-1/2`;
      case "right":
        return `${baseArrow} -left-1.5 top-1/2 -translate-y-1/2`;
      default:
        return `${baseArrow} -bottom-1.5 left-1/2 -translate-x-1/2`;
    }
  };

  const tooltipContent = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "pointer-events-none fixed",
            "rounded-lg border p-4 shadow-2xl backdrop-blur-lg",
            "bg-white/90 dark:bg-black/90",
            themeStyles[theme],
            maxWidth,
            className
          )}
          style={{
            left: coordinates.x,
            top: coordinates.y,
            zIndex,
          }}
        >
          {/* Arrow */}
          <div className={getArrowClasses()} />

          {/* Content */}
          <div className="space-y-3">
            {title && (
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Info className="h-4 w-4" />
                {title}
              </div>
            )}

            <div className="text-sm text-slate-700 dark:text-white/90">{content}</div>

            {impact && impact.length > 0 && (
              <div className="space-y-2 border-t border-white/10 pt-2">
                <div className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-white/70">
                  <TrendingUp className="h-3 w-3" />
                  Impact Analysis
                </div>
                {impact.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-white/80">{item.metric}</span>
                    <div className="flex items-center gap-1">
                      {item.change > 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-400" />
                      ) : item.change < 0 ? (
                        <TrendingDown className="h-3 w-3 text-red-400" />
                      ) : null}
                      <span
                        className={cn(
                          "font-medium",
                          item.change > 0
                            ? "text-green-400"
                            : item.change < 0
                              ? "text-red-400"
                              : "text-slate-600 dark:text-white/60"
                        )}
                      >
                        {item.change > 0 ? "+" : ""}
                        {item.change}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {warning && (
              <div className="flex items-start gap-2 rounded border border-red-400/30 bg-red-500/20 p-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                <div className="text-xs text-red-200">{warning}</div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-block"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>

      {typeof window !== "undefined" && createPortal(tooltipContent, document.body)}
    </>
  );
}

export function InfoIcon({ className, ...props }: React.ComponentProps<typeof HelpCircle>) {
  return (
    <HelpCircle
      className={cn(
        "h-4 w-4 cursor-help text-slate-500 transition-colors hover:text-slate-700 dark:text-white/40 dark:hover:text-white/70",
        className
      )}
      {...props}
    />
  );
}
