"use client";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useRealmClock } from "~/hooks/useRealmClock";
import { useRealmDate } from "~/hooks/useRealmDate";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  EraField,
  FoundingClockFields,
  SpeedField,
  emptyFoundingClock,
  foundingClockInput,
} from "~/components/realms/RealmClockFields";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  createRealmClock,
  formatRealmDate,
  formatRealmSpeed,
  nextJumpAt,
  nextSpeedChangeAt,
  parseRealmSpeed,
  realmClockNow,
  realmClockReader,
  type RealmClock,
} from "~/lib/realms/realm-clock";
import { ManageSection } from "./ManageSection";
import { RealmCalendarEditor } from "./RealmCalendarEditor";
import { RealmJumpControl } from "./RealmJumpControl";

interface RealmTime {
  realmId: string;
  clock: RealmClock | null;
  isIxnay: boolean;
  skipsCooldown: boolean;
}

/** The viewer's own calendar day ("21 October 2026"). */
const day = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** A realm that lost its clock (every realm gets one at founding): set a new one, continuous with Ixnay's time. */
function RepairClock({ slug }: { slug: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [draft, setDraft] = useState(emptyFoundingClock);
  const ixnay = useRealmClock(DEFAULT_REALM_ID);
  const start = api.realms.region.startClock.useMutation({
    onSuccess: () => {
      notify.success("The realm's clock is running");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not set the clock", error.message),
  });
  const input = foundingClockInput(draft);
  const preview =
    input && ixnay
      ? createRealmClock({ ...input, globalNowMs: ixnay.now(), realNowMs: Date.now() })
      : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-secondary text-footnote">
        This realm has no clock, so it shows Ixnay&apos;s date for now. Set the date it stands at,
        its era and its speed.
      </p>
      <FoundingClockFields value={draft} onChange={setDraft} />
      {preview && input && (
        <p className="text-label text-footnote">
          Starts at {formatRealmDate(realmClockNow(preview, Date.now()), preview)},{" "}
          {formatRealmSpeed(input.multiplier)}.
        </p>
      )}
      <div>
        <Button
          disabled={!input || start.isPending}
          onClick={() => input && start.mutate({ slug, ...input })}
        >
          Set the clock
        </Button>
      </div>
    </div>
  );
}

function SpeedAndEra({
  slug,
  clock,
  skipsCooldown,
}: {
  slug: string;
  clock: RealmClock;
  skipsCooldown: boolean;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [era, setEra] = useState(clock.era);
  const [speed, setSpeed] = useState(String(clock.multiplier));
  const update = api.realms.region.updateClock.useMutation({
    onSuccess: () => {
      notify.success("Time saved");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the time", error.message),
  });
  const next = nextSpeedChangeAt(clock);
  const locked = !skipsCooldown && Date.now() < next;
  const multiplier = parseRealmSpeed(speed);
  const speedChanged = multiplier !== null && multiplier !== clock.multiplier;
  const eraChanged = era.trim() !== clock.era;

  return (
    <div className="flex flex-col gap-4">
      <EraField value={era} onChange={setEra} />
      <SpeedField value={speed} onChange={setSpeed} disabled={locked} />
      {locked && (
        <p className="text-label-secondary text-footnote">
          The speed can change again on {day(next)}.
        </p>
      )}
      {speedChanged && (
        <p className="text-label text-footnote">
          {multiplier === 0
            ? "Pauses once saved."
            : `Runs at ${formatRealmSpeed(multiplier)} once saved.`}
        </p>
      )}
      <div>
        <Button
          disabled={(!speedChanged && !eraChanged) || multiplier === null || update.isPending}
          onClick={() =>
            update.mutate({
              slug,
              ...(speedChanged && multiplier !== null && { multiplier }),
              ...(eraChanged && { era: era.trim() }),
            })
          }
        >
          Save time
        </Button>
      </div>
    </div>
  );
}

function RunningClock({
  slug,
  realmId,
  clock,
  skipsCooldown,
}: {
  slug: string;
  realmId: string;
  clock: RealmClock;
  skipsCooldown: boolean;
}) {
  const reader = useMemo(() => realmClockReader(realmId, clock), [realmId, clock]);
  const date = useRealmDate(reader, null);
  return (
    <div className="flex flex-col gap-6">
      <p className="text-label text-body">
        {date}, {formatRealmSpeed(clock.multiplier)}
      </p>
      <SpeedAndEra slug={slug} clock={clock} skipsCooldown={skipsCooldown} />
      <Separator />
      <RealmCalendarEditor slug={slug} clock={clock} />
      <Separator />
      <RealmJumpControl
        slug={slug}
        reader={reader}
        nextJumpAt={nextJumpAt(clock)}
        skipsCooldown={skipsCooldown}
      />
    </div>
  );
}

/** Ixnay's clock is IxTime, synced with the Discord bot: site staff set its speed in Admin and may jump it here. */
function IxnayClock({ slug }: { slug: string }) {
  const reader = useRealmClock(DEFAULT_REALM_ID);
  const date = useRealmDate(reader, null);
  return (
    <div className="flex flex-col gap-6">
      <p className="text-label-secondary text-footnote">
        {date ? `${date}. ` : ""}Ixnay&apos;s clock is IxTime, synced with the Discord bot. Site
        staff set its speed in Admin.
      </p>
      {reader && <RealmJumpControl slug={slug} reader={reader} nextJumpAt={0} skipsCooldown />}
    </div>
  );
}

/** Manage → Time: the realm's own clock and calendar (founder and site staff). */
export function RealmTimeSection({ slug, time }: { slug: string; time: RealmTime }) {
  return (
    <ManageSection
      id="time"
      title="Time"
      description="The realm's own date, speed and calendar. Its nations run on it; other realms keep their own."
    >
      {time.isIxnay ? (
        <IxnayClock slug={slug} />
      ) : time.clock ? (
        <RunningClock
          // A clock changed elsewhere (staff, another tab) starts the forms over from it.
          key={JSON.stringify(time.clock)}
          slug={slug}
          realmId={time.realmId}
          clock={time.clock}
          skipsCooldown={time.skipsCooldown}
        />
      ) : (
        <RepairClock slug={slug} />
      )}
    </ManageSection>
  );
}
