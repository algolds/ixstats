"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Signal } from "~/components/ui/signal";
import { isRealmSlug, slugFromName } from "~/lib/worldgen/studio-apply";
import { api } from "~/trpc/react";
import { useStudio } from "./StudioContext";
import { StudioRealmApply } from "./StudioRealmApply";

interface Created {
  realmId: string;
  slug: string;
  name: string;
}

/** A realm made from this world, and the way on to its page in Atlas. */
function CreatedRealm({ created, onAnother }: { created: Created; onAnother: () => void }) {
  return (
    <div className="space-y-3">
      <Signal tone="info" title={`${created.name} is created`}>
        <p>
          An unlisted draft realm that you own. Use the world below to put it on the realm. If that
          fails, the realm stays as it is.
        </p>
        <p className="mt-1">
          <Link
            className="text-tint underline"
            href={`/admin/maps/realms/${encodeURIComponent(created.slug)}`}
          >
            Open {created.name} in Atlas
          </Link>
        </p>
      </Signal>
      <StudioRealmApply realm={{ id: created.realmId, slug: created.slug }} source="preset" />
      <Button size="sm" variant="outline" onClick={onAnother}>
        Make another realm
      </Button>
    </div>
  );
}

/**
 * New realm from this world: a draft, unlisted realm with the admin as owner, then the founder's check and apply on
 * it. Only a world made from a preset can start a realm; one fitted to a map already belongs to one.
 */
export function StudioNewRealmSection() {
  const { source } = useStudio();
  const utils = api.useUtils();
  const createRealm = api.atlas.studio.createRealm.useMutation();
  const nameId = useId();
  const slugId = useId();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (source.kind !== "preset") {
    return (
      <section aria-label="New realm from this world" className="space-y-2">
        <h4 className="text-headline">New realm from this world</h4>
        <p className="text-label-secondary text-caption">
          Set the source to a preset to make a new realm: a world fitted to a map belongs to that
          realm.
        </p>
      </section>
    );
  }

  const shownSlug = slug ?? slugFromName(name);
  const valid = name.trim() !== "" && isRealmSlug(shownSlug);
  const create = async () => {
    if (!valid || creating) return;
    setCreating(true);
    setError(null);
    try {
      const made = await createRealm.mutateAsync({ name: name.trim(), slug: shownSlug });
      setCreated({ ...made, name: name.trim() });
      void utils.atlas.realms.overview.invalidate();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The realm could not be made.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section aria-label="New realm from this world" className="space-y-3">
      <h4 className="text-headline">New realm from this world</h4>
      {created ? (
        <CreatedRealm
          created={created}
          onAnother={() => {
            setCreated(null);
            setName("");
            setSlug(null);
          }}
        />
      ) : (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="space-y-1">
            <label htmlFor={nameId} className="text-label-secondary text-caption block">
              Realm name
            </label>
            <Input
              id={nameId}
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              className="text-footnote h-(--control-height-sm)"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={slugId} className="text-label-secondary text-caption block">
              Web address
            </label>
            <Input
              id={slugId}
              value={shownSlug}
              maxLength={40}
              onChange={(event) => setSlug(event.target.value)}
              className="text-footnote h-(--control-height-sm)"
            />
            {shownSlug !== "" && !isRealmSlug(shownSlug) && (
              <p className="text-label-secondary text-caption">
                Two to 40 lower-case letters, digits or hyphens.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-destructive text-caption">
              {error}
            </p>
          )}
          <Button type="submit" size="sm" disabled={!valid || creating}>
            {creating ? "Creating the realm" : "Create the realm"}
          </Button>
        </form>
      )}
    </section>
  );
}
