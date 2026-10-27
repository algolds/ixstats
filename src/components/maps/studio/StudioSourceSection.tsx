"use client";

import { useId } from "react";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ValueSelect } from "~/components/ui/value-select";
import { useStudio, type StudioRealm } from "./StudioContext";

type SourceKind = "preset" | "fit";

/** The realm a switch to the fit source starts with: Ixnay if it can be fitted to, else the first that can. */
function defaultRealm(realms: readonly StudioRealm[]): string | null {
  const eligible = realms.filter((realm) => realm.hasPolitical);
  return (eligible.find((realm) => realm.isIxnay) ?? eligible[0])?.slug ?? null;
}

function FitNotice() {
  const { source, fit, realmsState } = useStudio();
  if (source.kind !== "fit") return null;
  if (realmsState === "failed")
    return <p className="text-destructive text-caption">The realms could not be listed.</p>;
  if (source.realm === null)
    return <p className="text-label-secondary text-caption">Choose a realm to fit the world to.</p>;
  if (fit.state === "loading")
    return <p className="text-label-secondary text-caption">Loading the realm's map.</p>;
  if (fit.state === "none")
    return (
      <p className="text-label-secondary text-caption">
        This realm has no political layer to build on.
      </p>
    );
  if (fit.state === "failed")
    return (
      <div className="space-y-1">
        <p className="text-label-secondary text-caption">
          The realm's map could not be loaded, so a world can't be built around it.
        </p>
        <Button type="button" size="xs" variant="outline" onClick={fit.retry}>
          Try again
        </Button>
      </div>
    );
  return (
    <p className="text-label-secondary text-caption">
      The land and the borders stay as the realm drew them. Climate, rivers, lakes and elevation are
      generated around them, except for any the realm already has.
    </p>
  );
}

/** Preset, or fit to a realm's map (any realm with a political layer, Ixnay too). */
export function StudioSourceSection() {
  const { source, setSource, realms, realmsState, presetSlug } = useStudio();
  const labelId = useId();
  const realmId = useId();
  const eligible = realms.filter((realm) => realm.hasPolitical);

  const pickKind = (kind: SourceKind) => {
    if (kind === "preset") setSource({ kind: "preset", preset: presetSlug });
    else
      setSource({
        kind: "fit",
        preset: presetSlug,
        realm: source.kind === "fit" ? source.realm : defaultRealm(realms),
      });
  };

  return (
    <div className="space-y-2">
      <span id={labelId} className="text-label text-footnote">
        Source
      </span>
      <SegmentedControl
        aria-labelledby={labelId}
        size="sm"
        fullWidth
        value={source.kind}
        onValueChange={pickKind}
        options={[
          { value: "preset", label: "Preset" },
          { value: "fit", label: "Fit to a realm's map" },
        ]}
      />
      {source.kind === "fit" && (
        <div className="space-y-1">
          <label htmlFor={realmId} className="text-label text-footnote">
            Realm
          </label>
          <ValueSelect
            id={realmId}
            size="sm"
            className="w-full"
            value={source.realm ?? undefined}
            placeholder={realmsState === "loading" ? "Loading the realms" : "Choose a realm"}
            options={eligible.map((realm): [string, string] => [realm.slug, realm.name])}
            onValueChange={(realm) => setSource({ kind: "fit", preset: presetSlug, realm })}
          />
        </div>
      )}
      <FitNotice />
    </div>
  );
}
