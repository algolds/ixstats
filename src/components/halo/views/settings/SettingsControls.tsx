"use client";

import React, { useCallback, useState, useEffect } from "react";
import { PreText } from "~/components/ui/pretext";
import { Switch } from "~/components/ui/switch";

export function useLocalPref(
  key: string,
  defaultValue: boolean
): [boolean, (checked: boolean) => void] {
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
    <div className="text-subhead text-label-secondary px-1 pt-2 pb-1">
      {typeof children === "string" ? <PreText whiteSpace="nowrap">{children}</PreText> : children}
    </div>
  );
}
