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
  REALM_LABEL_DEFAULTS,
  REALM_LABEL_TYPE_NAMES,
  REALM_LABEL_TYPES,
  type RealmLabelType,
} from "~/lib/maps/realm-labels";
import type { EditorMapRef } from "../EditorMap";

/** The map's centre, rounded, as a label anchor. */
function mapCentre(mapRef: RefObject<EditorMapRef | null>): [number, number] | null {
  const centre = mapRef.current?.getMap()?.getCenter().wrap();
  if (!centre) return null;
  return [Math.round(centre.lng * 1e4) / 1e4, Math.round(centre.lat * 1e4) / 1e4];
}

/**
 * The realm's own labels: oceans, seas, regions and continents, each with its size, weight, spacing and colour.
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
  const [fontSize, setFontSize] = useState(String(REALM_LABEL_DEFAULTS.ocean.fontSize));
  const [fontWeight, setFontWeight] = useState<"normal" | "bold">(
    REALM_LABEL_DEFAULTS.ocean.fontWeight
  );
  const [color, setColor] = useState(REALM_LABEL_DEFAULTS.ocean.color);

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
    const defaults = REALM_LABEL_DEFAULTS[type];
    setLabelType(type);
    setFontSize(String(defaults.fontSize));
    setFontWeight(defaults.fontWeight);
    setColor(defaults.color);
  };

  const size = Number(fontSize);
  const sizeOk = Number.isFinite(size) && size >= 8 && size <= 64;
  const add = () => {
    const coordinates = mapCentre(mapRef);
    if (!coordinates) return;
    const defaults = REALM_LABEL_DEFAULTS[labelType];
    create.mutate({
      realm,
      text: text.trim(),
      labelType,
      coordinates,
      fontSize: size,
      fontWeight,
      fontStyle: defaults.fontStyle,
      color,
      letterSpacing: defaults.letterSpacing,
      minZoom: defaults.minZoom,
      maxZoom: defaults.maxZoom,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Realm labels</DialogTitle>
          <DialogDescription>
            Name the realm's oceans, seas, regions and continents. A new label goes at the centre of
            the current view.
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="realm-label-size">Font size</Label>
              <Input
                id="realm-label-size"
                type="number"
                min={8}
                max={64}
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                aria-invalid={!sizeOk}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="realm-label-color">Colour</Label>
              <Input
                id="realm-label-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
          <SegmentedControl
            aria-label="Font weight"
            size="sm"
            value={fontWeight}
            onValueChange={setFontWeight}
            options={[
              { value: "normal", label: "Regular" },
              { value: "bold", label: "Bold" },
            ]}
          />
          <div>
            <Button size="sm" disabled={!text.trim() || !sizeOk || create.isPending} onClick={add}>
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
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="text-label text-footnote flex-1 truncate">
                    {label.text}
                    <span className="text-label-secondary">
                      {" "}
                      ·{" "}
                      {REALM_LABEL_TYPE_NAMES[label.labelType as RealmLabelType] ?? label.labelType}
                      , {label.fontSize}px
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
