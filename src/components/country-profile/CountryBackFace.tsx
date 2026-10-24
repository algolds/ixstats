"use client";

import Link from "next/link";
import { Check, EditPencil, Crown } from "iconoir-react";
import { Button } from "~/components/ui/button";
import type { ProfileOwnerLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { CoverOptions, type HeroCover } from "./HeroMedia";
import { OwnerLayer } from "./OwnerLayer";

/**
 * CountryBackFace — the back of the country document's face, the owner's side (turned to with
 * Manage, like the passport's Edit): the private owner strip, the cover choice, MyCountry and the editor.
 */
export function CountryBackFace({
  name,
  cover,
  owner,
  onDone,
}: {
  name: string;
  cover: HeroCover | null;
  owner: ProfileOwnerLayer | null;
  onDone: () => void;
}) {
  return (
    <section aria-label={`Manage ${name}`} className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-2 text-label">Manage {name}</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/mycountry">
              <Crown aria-hidden />
              Open MyCountry
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/mycountry/editor">
              <EditPencil aria-hidden />
              Edit country
            </Link>
          </Button>
          <Button size="sm" onClick={onDone}>
            <Check aria-hidden />
            Done
          </Button>
        </div>
      </div>
      <OwnerLayer owner={owner} />
      {cover?.onChange && <CoverOptions cover={{ ...cover, onChange: cover.onChange }} />}
    </section>
  );
}
