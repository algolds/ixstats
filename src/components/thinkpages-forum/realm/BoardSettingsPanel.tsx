"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Settings as SettingsIcon } from "iconoir-react";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Signal } from "~/components/ui/signal";
import { Switch } from "~/components/ui/switch";
import { SLOW_MODE_SECONDS } from "~/lib/thinkpages-forum/board";
import { api } from "~/trpc/react";
import { RailPanel } from "../shell";
import type { BoardData } from "./types";

type Settings = BoardData["realm"]["settings"];

const SLOW_MODE_LABELS: Record<(typeof SLOW_MODE_SECONDS)[number], string> = {
  0: "Off",
  10: "10s",
  30: "30s",
  60: "1m",
  300: "5m",
};

interface BoardSettingsPanelProps {
  realmId: string;
  slug: string;
  settings: Settings;
}

/**
 * Whether visitors may post and the slow mode, for those allowed to change them (the caller checks
 * `access.canManageSettings`; the server asks again). A change shows at once in the cached board and is put back,
 * for that setting alone, when the server refuses. Other viewers get the new rules through the live settings event.
 */
export function BoardSettingsPanel({ realmId, slug, settings }: BoardSettingsPanelProps) {
  const utils = api.useUtils();
  // A refusal is the answer: retrying it would leave the optimistic value on screen through the backoff.
  const { mutateAsync } = api.thinkpagesForum.updateBoardSettings.useMutation({ retry: false });
  const [error, setError] = useState<string | null>(null);
  const switchId = useId();
  // What the server last confirmed. `settings` includes changes not yet confirmed (shown at once), so a refusal puts
  // back this and not what the screen showed an instant ago (a second toggle before the first answer).
  const confirmed = useRef(settings);
  const inFlight = useRef(0);
  useEffect(() => {
    if (inFlight.current === 0) confirmed.current = settings;
  }, [settings]);

  const show = useCallback(
    (change: Partial<Settings>) =>
      utils.thinkpagesForum.getBoard.setData(
        { realm: slug },
        (old) =>
          old && { ...old, realm: { ...old.realm, settings: { ...old.realm.settings, ...change } } }
      ),
    [utils, slug]
  );

  const change = useCallback(
    async (patch: Partial<Settings>) => {
      setError(null);
      inFlight.current += 1;
      // A poll in flight from before the change would put the old rules back over it.
      await utils.thinkpagesForum.getBoard.cancel({ realm: slug });
      show(patch);
      try {
        const saved = await mutateAsync({ realmId, ...patch });
        confirmed.current = saved;
        show(saved);
      } catch (e) {
        const before: Partial<Settings> = {};
        if (patch.visitorsAllowed !== undefined) {
          before.visitorsAllowed = confirmed.current.visitorsAllowed;
        }
        if (patch.slowModeSeconds !== undefined) {
          before.slowModeSeconds = confirmed.current.slowModeSeconds;
        }
        show(before);
        setError(e instanceof Error ? e.message : "Could not save the settings");
      } finally {
        inFlight.current -= 1;
      }
    },
    [utils, slug, show, mutateAsync, realmId]
  );

  return (
    <RailPanel title="Board settings" icon={<SettingsIcon />}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={switchId} className="text-callout">
            Visitors can post
          </Label>
          <Switch
            id={switchId}
            checked={settings.visitorsAllowed}
            onCheckedChange={(visitorsAllowed) => void change({ visitorsAllowed })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-callout">Slow mode</span>
          <Select
            value={String(settings.slowModeSeconds)}
            onValueChange={(seconds) => void change({ slowModeSeconds: Number(seconds) })}
          >
            <SelectTrigger size="sm" aria-label="Slow mode" className="min-w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOW_MODE_SECONDS.map((seconds) => (
                <SelectItem key={seconds} value={String(seconds)}>
                  {SLOW_MODE_LABELS[seconds]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? <Signal tone="destructive" title={error} /> : null}
      </div>
    </RailPanel>
  );
}
