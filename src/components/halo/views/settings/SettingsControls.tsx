"use client";

import React, { useCallback, useState, useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { SoundOff as VolumeX } from "iconoir-react";
import { PreText } from "~/components/ui/pretext";
import { Switch } from "~/components/ui/switch";

export function useLocalToggle(key: string, defaultValue: boolean): [boolean, () => void] {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      // oxlint-disable-next-line
      if (stored !== null) setValue(stored === "true");
    } catch {
      /* SSR */
    }
  }, [key]);
  const toggle = useCallback(() => {
    setValue((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, String(next));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("wikios-settings-changed"));
        }
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [key]);
  return [value, toggle];
}

export function useLocalPref(key: string, defaultValue: boolean): [boolean, (checked: boolean) => void] {
  const [val, setVal] = useState(defaultValue);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      // oxlint-disable-next-line
      if (stored !== null) setVal(stored === "true");
    } catch {
      /* SSR */
    }
  }, [key]);

  const update = useCallback(
    (checked: boolean) => {
      setVal(checked);
      try {
        localStorage.setItem(key, String(checked));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("wikios-settings-changed"));
        }
      } catch {
        /* ignore */
      }
    },
    [key]
  );

  return [val, update];
}

export function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return <Switch checked={enabled} onCheckedChange={onToggle} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground px-1 pt-2 pb-1 text-[11px] font-semibold tracking-wider uppercase">
      {typeof children === "string" ? <PreText whiteSpace="nowrap">{children}</PreText> : children}
    </div>
  );
}

export function AnimatedVolumeIcon({
  enabled,
  isHovered = false,
  className = "h-3.5 w-3.5",
}: {
  enabled: boolean;
  isHovered?: boolean;
  className?: string;
}) {
  if (!enabled) {
    return <VolumeX className={cn("text-muted-foreground", className)} />;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-emerald-600 dark:text-emerald-400 overflow-visible", className)}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <motion.path
        d="M15.54 8.46a5 5 0 0 1 0 7.07"
        className="origin-[11px_12px]"
        initial={{ opacity: 1, scale: 1 }}
        animate={
          isHovered
            ? {
                opacity: [0.35, 1, 0.35],
                scale: [0.95, 1.08, 0.95],
              }
            : { opacity: 1, scale: 1 }
        }
        transition={
          isHovered
            ? {
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : { duration: 0.2 }
        }
      />
      <motion.path
        d="M19.07 4.93a10 10 0 0 1 0 14.14"
        className="origin-[11px_12px]"
        initial={{ opacity: 1, scale: 1 }}
        animate={
          isHovered
            ? {
                opacity: [0.2, 1, 0.2],
                scale: [0.9, 1.15, 0.9],
              }
            : { opacity: 1, scale: 1 }
        }
        transition={
          isHovered
            ? {
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.16,
              }
            : { duration: 0.2 }
        }
      />
    </svg>
  );
}
