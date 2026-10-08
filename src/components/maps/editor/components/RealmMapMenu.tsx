"use client";

import { useSearchParams } from "next/navigation";
import { wantsRealmLabelsEditor } from "~/lib/maps/realm-labels";
import { useState, type RefObject } from "react";
import { Map as MapIcon, Pin, Text } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils/cn";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { useRealmMapDisplay } from "~/components/maps/core/hooks/useRealmMapDisplay";
import type { EditorMapRef } from "../EditorMap";
import { RealmLabelsDialog } from "./RealmLabelsDialog";

const ICON = "h-3.5 w-3.5 shrink-0";

/**
 * The world editor's realm menu, for the realm's map editors (site admins, the founder, officers with the Map
 * power) on a realm other than IxWorld: save the current view as the map's default, and manage the realm's own
 * labels (oceans, seas, regions, continents).
 */
export function RealmMapMenu({ mapRef }: { mapRef: RefObject<EditorMapRef | null> }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const searchParams = useSearchParams();
  const realm = useMapRealm();
  const display = useRealmMapDisplay(realm);
  const [open, setOpen] = useState(false);
  // Opened straight from the admin panel's link (`/maps?realm=…&editor=labels`).
  const [labelsOpen, setLabelsOpen] = useState(() => wantsRealmLabelsEditor(searchParams));
  const save = api.realms.map.updateSettings.useMutation({
    onSuccess: () => {
      notify.success("Default view saved", "The realm's map now opens here.");
      void utils.realms.map.display.invalidate();
    },
    onError: (error) => notify.error("Could not save the default view", error.message),
  });

  if (!display?.canEdit || display.isIxWorld || !display.realmSlug) return null;
  const realmSlug = display.realmSlug;

  const saveView = () => {
    setOpen(false);
    const map = mapRef.current?.getMap();
    if (!map) return;
    const center = map.getCenter().wrap();
    save.mutate({
      realm: realmSlug,
      defaultView: {
        center: [
          Math.round(center.lng * 1e4) / 1e4,
          Math.max(-85, Math.min(85, Math.round(center.lat * 1e4) / 1e4)),
        ],
        zoom: Math.round(map.getZoom() * 100) / 100,
      },
    });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", open ? "bg-fill-3 text-label" : "text-label-secondary")}
            title="Realm map"
            aria-label="Realm map"
          >
            <MapIcon className={ICON} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="rounded-row w-64 p-2" align="end">
          <p className="text-label-secondary text-caption px-2 pb-1">{display.realmName}</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-label-secondary w-full justify-start px-2"
            onClick={saveView}
            disabled={save.isPending}
          >
            <Pin className={ICON} />
            <span className="font-medium">Save current view as default</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-label-secondary w-full justify-start px-2"
            onClick={() => {
              setOpen(false);
              setLabelsOpen(true);
            }}
          >
            <Text className={ICON} />
            <span className="font-medium">Realm labels…</span>
          </Button>
        </PopoverContent>
      </Popover>
      {labelsOpen && (
        <RealmLabelsDialog
          realm={realmSlug}
          mapRef={mapRef}
          open={labelsOpen}
          onOpenChange={setLabelsOpen}
        />
      )}
    </>
  );
}
