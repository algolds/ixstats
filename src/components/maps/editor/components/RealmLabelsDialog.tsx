"use client";

import { useState, type RefObject } from "react";
import { Pin, Trash as Trash2 } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  REALM_LABEL_DEFAULT_RANK,
  REALM_LABEL_RANK_NAMES,
  REALM_LABEL_RANKS,
  REALM_LABEL_TYPE_NAMES,
  REALM_LABEL_TYPES,
  type RealmLabelRank,
  type RealmLabelType,
} from "~/lib/maps/realm-labels";
import type { EditorMapRef } from "../EditorMap";

/** The map's centre, rounded, as a label anchor. */
function mapCentre(mapRef: RefObject<EditorMapRef | null>): [number, number] | null {
  const centre = mapRef.current?.getMap()?.getCenter().wrap();
  if (!centre) return null;
  return [Math.round(centre.lng * 1e4) / 1e4, Math.round(centre.lat * 1e4) / 1e4];
}

const RANK_OPTIONS = REALM_LABEL_RANKS.map((rank) => ({
  value: rank,
  label: REALM_LABEL_RANK_NAMES[rank],
}));

/**
 * The realm's own labels: oceans, seas, regions and continents, drawn like IxWorld's ocean names. Each has a kind and
 * a rank: major names show from the globe view, medium ones from a closer zoom, minor ones (bays, straits) closer in.
 * A new label goes at the centre of the editor's view; "Move here" re-anchors one there.
 */
export function RealmLabelsDialog({
  realm,
  mapRef,
  open,
  onOpenChange,
}: {
  realm: string;
  mapRef: RefObject<EditorMapRef | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data: labels = [], isLoading } = api.geoFeatures.listRealmLabels.useQuery({ realm });
  const [text, setText] = useState("");
  const [labelType, setLabelType] = useState<RealmLabelType>("ocean");
  const [rank, setRank] = useState<RealmLabelRank>(REALM_LABEL_DEFAULT_RANK.ocean);

  const refresh = () => {
    void utils.geoFeatures.listRealmLabels.invalidate();
    void utils.geoFeatures.getAllMapLabels.invalidate();
  };
  const onError = (error: { message: string }) =>
    notify.error("Could not save the label", error.message);
  const create = api.geoFeatures.createRealmLabel.useMutation({
    onSuccess: () => {
      setText("");
      refresh();
    },
    onError,
  });
  const update = api.geoFeatures.updateRealmLabel.useMutation({ onSuccess: refresh, onError });
  const remove = api.geoFeatures.deleteRealmLabel.useMutation({ onSuccess: refresh, onError });

  const chooseType = (type: RealmLabelType) => {
    setLabelType(type);
    setRank(REALM_LABEL_DEFAULT_RANK[type]);
  };

  const add = () => {
    const coordinates = mapCentre(mapRef);
    if (!coordinates) return;
    create.mutate({ realm, text: text.trim(), labelType, coordinates, rank });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Realm labels</DialogTitle>
          <DialogDescription>
            Name the realm's oceans, seas, regions and continents, drawn like IxWorld's ocean names.
            Major names show from the globe view, medium ones closer in, minor ones (bays, straits)
            closest. A new label goes at the centre of the current view.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="realm-label-text">Name</Label>
              <Input
                id="realm-label-text"
                value={text}
                maxLength={100}
                placeholder="Sunless Sea"
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label id="realm-label-type">Kind</Label>
              <Select value={labelType} onValueChange={(v) => chooseType(v as RealmLabelType)}>
                <SelectTrigger aria-labelledby="realm-label-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REALM_LABEL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {REALM_LABEL_TYPE_NAMES[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SegmentedControl
            aria-label="Rank"
            size="sm"
            value={rank}
            onValueChange={setRank}
            options={RANK_OPTIONS}
          />
          <div>
            <Button size="sm" disabled={!text.trim() || create.isPending} onClick={add}>
              Add label here
            </Button>
          </div>
        </div>

        <div className="border-separator mt-2 border-t pt-3">
          {isLoading ? (
            <p className="text-label-secondary text-footnote">Loading labels…</p>
          ) : labels.length === 0 ? (
            <p className="text-label-secondary text-footnote">No realm labels yet.</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {labels.map((label) => (
                <li key={label.id} className="flex items-center gap-2">
                  <span className="text-label text-footnote flex-1 truncate">
                    {label.text}
                    <span className="text-label-secondary">
                      {" "}
                      ·{" "}
                      {REALM_LABEL_TYPE_NAMES[label.labelType as RealmLabelType] ?? label.labelType}
                      , {REALM_LABEL_RANK_NAMES[label.rank].toLowerCase()}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Move here"
                    aria-label={`Move ${label.text} to the centre of the view`}
                    disabled={update.isPending}
                    onClick={() => {
                      const coordinates = mapCentre(mapRef);
                      if (coordinates) update.mutate({ realm, labelId: label.id, coordinates });
                    }}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Delete"
                    aria-label={`Delete ${label.text}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ realm, labelId: label.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
