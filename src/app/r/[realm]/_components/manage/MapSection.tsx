"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { EARTH_RADIUS_KM } from "~/lib/maps/planet";
import {
  MAX_MAP_ATTRIBUTION_LENGTH,
  MAX_REALM_RADIUS_KM,
  MIN_REALM_RADIUS_KM,
} from "~/lib/maps/realm-map-settings";
import { ManageSection } from "./ManageSection";
import { RealmImageField } from "./RealmImageField";

/**
 * The realm's map (founder and officers with the Map power): planet radius, base image, credit line, the default
 * view (saved from the world editor) and "Recompute areas". Borders, region links and labels are edited in the
 * world editor on the realm's map.
 */
export function MapSection({ slug }: { slug: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data: display } = api.realms.map.display.useQuery({ realm: slug });

  const [radius, setRadius] = useState("");
  const [baseImage, setBaseImage] = useState("");
  const [attribution, setAttribution] = useState("");
  const [alsoSetLandArea, setAlsoSetLandArea] = useState(false);

  useEffect(() => {
    if (!display) return;
    setRadius(display.radiusKm === EARTH_RADIUS_KM ? "" : String(display.radiusKm));
    setBaseImage(display.baseImage ?? "");
  }, [display]);

  const refresh = () => void utils.realms.map.display.invalidate();
  const save = api.realms.map.updateSettings.useMutation({
    onSuccess: () => {
      notify.success("Map settings saved");
      refresh();
    },
    onError: (error) => notify.error("Could not save the map settings", error.message),
  });
  const recompute = api.realms.map.recomputeAreas.useMutation({
    onSuccess: (result) =>
      notify.success(
        `Measured ${result.updated} map features again`,
        result.countriesUpdated > 0
          ? `${result.countriesUpdated} nations now show their map area`
          : "Nations kept their stated land area"
      ),
    onError: (error) => notify.error("Could not recompute areas", error.message),
  });

  const radiusValue = radius.trim() === "" ? null : Number(radius);
  const radiusOk =
    radiusValue === null ||
    (Number.isFinite(radiusValue) &&
      radiusValue >= MIN_REALM_RADIUS_KM &&
      radiusValue <= MAX_REALM_RADIUS_KM);
  const view = display?.defaultView;

  return (
    <ManageSection
      id="map"
      title="Map"
      description="How the realm's map is measured and shown. Edit borders, region links and labels in the world editor on the realm's map."
    >
      <div className="flex flex-col gap-4">
        <p className="text-footnote">
          <Link className="text-tint underline" href={`/maps?realm=${encodeURIComponent(slug)}`}>
            Open the realm's map
          </Link>{" "}
          <span className="text-label-secondary">and choose World editor.</span>
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="realm-map-radius">Planet radius (km)</Label>
          <Input
            id="realm-map-radius"
            type="number"
            inputMode="decimal"
            min={MIN_REALM_RADIUS_KM}
            max={MAX_REALM_RADIUS_KM}
            value={radius}
            placeholder={`${EARTH_RADIUS_KM} (Earth)`}
            onChange={(e) => setRadius(e.target.value)}
            aria-invalid={!radiusOk}
          />
          <p className="text-label-secondary text-footnote">
            Scales every area and distance measured on the map. Empty means Earth's{" "}
            {EARTH_RADIUS_KM} km. After changing it, recompute areas below.
          </p>
        </div>

        <RealmImageField
          id="realm-map-base-image"
          label="Base map image"
          value={baseImage}
          onChange={setBaseImage}
          previewClassName="aspect-[2/1] w-full max-w-md"
        />
        <p className="text-label-secondary text-footnote -mt-2">
          A full-globe equirectangular image (2:1, 180°W to 180°E, cropped to 85°N to 85°S), drawn
          under the borders. Uploads are up to 5MB; an https:// image must allow cross-origin use
          (CORS) and should be at most 8192 by 4096 pixels.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="realm-map-attribution">Credit line</Label>
          <Input
            id="realm-map-attribution"
            value={attribution}
            maxLength={MAX_MAP_ATTRIBUTION_LENGTH}
            placeholder={display?.attribution ?? "Map by…"}
            onChange={(e) => setAttribution(e.target.value)}
          />
          <p className="text-label-secondary text-footnote">
            Shown on the realm's map. Empty uses the source sync's attribution, when it has one.
          </p>
        </div>

        <p className="text-label-secondary text-footnote">
          Default view:{" "}
          {view
            ? `${view.center[1].toFixed(2)}°, ${view.center[0].toFixed(2)}° at zoom ${view.zoom.toFixed(1)}`
            : "not set (the map opens on the whole world)"}
          . Set it from the world editor with "Save current view as default".
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!radiusOk || save.isPending}
            onClick={() =>
              save.mutate({
                realm: slug,
                radiusKm: radiusValue,
                baseImage: baseImage.trim() || null,
                ...(attribution.trim() && { attribution: attribution.trim() }),
              })
            }
          >
            Save map settings
          </Button>
          {display?.attribution && (
            <Button
              size="sm"
              variant="outline"
              disabled={save.isPending}
              onClick={() => save.mutate({ realm: slug, attribution: null })}
            >
              Clear credit line
            </Button>
          )}
          {view && (
            <Button
              size="sm"
              variant="outline"
              disabled={save.isPending}
              onClick={() => save.mutate({ realm: slug, defaultView: null })}
            >
              Clear default view
            </Button>
          )}
        </div>

        <div className="border-separator flex flex-col gap-3 border-t pt-4">
          <p className="text-label-secondary text-footnote">
            Recompute areas measures every region, lake and zone of the map again on the planet
            radius. Nations keep their stated land area unless you tick the box.
          </p>
          {display?.isFounder && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="realm-map-land-area"
                checked={alsoSetLandArea}
                onCheckedChange={(v) => setAlsoSetLandArea(v === true)}
              />
              <Label htmlFor="realm-map-land-area">Also set nations' land area from the map</Label>
            </div>
          )}
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={recompute.isPending}
              onClick={() => recompute.mutate({ realm: slug, alsoSetLandArea })}
            >
              {recompute.isPending ? "Recomputing…" : "Recompute areas"}
            </Button>
          </div>
        </div>
      </div>
    </ManageSection>
  );
}
