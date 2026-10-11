"use client";

import Link from "next/link";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";

export interface ClaimConsentValue {
  accepted: boolean;
  permissionNote: string;
}

export const NO_CONSENT: ClaimConsentValue = { accepted: false, permissionNote: "" };

/** What a claim mutation sends as `consent`. The claim buttons stay disabled until the box is ticked. */
export function consentInput(value: ClaimConsentValue): {
  accepted: true;
  permissionNote?: string;
} {
  const note = value.permissionNote.trim();
  return { accepted: true, ...(note && { permissionNote: note }) };
}

/**
 * The realm content terms consent every claim carries (ToS §2.6): the nation's material is the claimant's own
 * work, or they have its creator's permission and may say who gave it (the moderators see the note).
 */
export function ClaimConsent({
  nationName,
  value,
  onChange,
}: {
  /** Omitted where one box covers whichever nation is claimed (a list of claimable pages). */
  nationName?: string;
  value: ClaimConsentValue;
  onChange: (value: ClaimConsentValue) => void;
}) {
  const material = nationName ? `${nationName}'s` : "The nation's";
  return (
    <div className="bg-fill-4 rounded-row flex flex-col gap-2 p-3">
      <label className="text-label text-footnote flex items-start gap-2">
        <Checkbox
          className="mt-0.5"
          checked={value.accepted}
          onCheckedChange={(checked) => onChange({ ...value, accepted: checked === true })}
        />
        <span>
          {material} wiki pages, flag and other material are my own work, or I have their
          creator&apos;s permission to bring them here.
        </span>
      </label>
      <p className="text-label-secondary text-footnote">
        You keep ownership. IxStates and the realm may show and use this material in the realm while
        you hold {nationName ?? "the nation"}. If you leave or stop playing, it comes down and only
        the shared history stays.{" "}
        <Link
          href="/terms#intellectual-property"
          className="text-tint underline-offset-4 hover:underline"
        >
          Realm content terms
        </Link>
      </p>
      <Input
        aria-label="Who gave permission"
        value={value.permissionNote}
        onChange={(e) => onChange({ ...value, permissionNote: e.target.value })}
        maxLength={500}
        placeholder="If it is someone else's work, who gave permission? (optional)"
        className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
      />
    </div>
  );
}
