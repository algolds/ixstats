"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useUser } from "~/context/auth-context";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SearchField } from "~/components/ui/search-field";
import {
  MAX_OFFICERS,
  REALM_POWER_LABELS,
  REALM_POWERS,
  type RealmPower,
} from "~/lib/realms/realm-region";
import { ManageSection, type RealmManage } from "./ManageSection";

function PowerChecks({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: RealmPower[];
  onChange: (next: RealmPower[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {REALM_POWERS.map((power) => (
        <label
          key={power}
          htmlFor={`${idPrefix}-${power}`}
          className="text-label text-footnote flex items-center gap-2"
        >
          <Checkbox
            id={`${idPrefix}-${power}`}
            disabled={disabled}
            checked={value.includes(power)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...value, power] : value.filter((p) => p !== power))
            }
          />
          {REALM_POWER_LABELS[power]}
        </label>
      ))}
    </div>
  );
}

function OfficerRow({
  slug,
  officer,
  isFounder,
  isSelf,
}: {
  slug: string;
  officer: RealmManage["officers"][number];
  isFounder: boolean;
  isSelf: boolean;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [title, setTitle] = useState(officer.title);
  const [powers, setPowers] = useState<RealmPower[]>(
    officer.powers.filter((p): p is RealmPower => (REALM_POWERS as readonly string[]).includes(p))
  );
  const done = (message: string) => () => {
    notify.success(message);
    void utils.realms.region.invalidate();
  };
  const update = api.realms.region.updateOfficer.useMutation({
    onSuccess: done("Officer updated"),
    onError: (error) => notify.error("Could not update the officer", error.message),
  });
  const remove = api.realms.region.removeOfficer.useMutation({
    onSuccess: done(isSelf ? "You resigned" : "Officer removed"),
    onError: (error) => notify.error("Could not remove the officer", error.message),
  });

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <p className="text-label text-body font-medium">{officer.name}</p>
      {isFounder ? (
        <>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            aria-label={`Title of ${officer.name}`}
          />
          <PowerChecks idPrefix={`officer-${officer.userId}`} value={powers} onChange={setPowers} />
        </>
      ) : (
        <p className="text-label-secondary text-footnote">
          {officer.title}
          {officer.powers.length > 0 &&
            ` · ${officer.powers.map((p) => REALM_POWER_LABELS[p as RealmPower] ?? p).join(", ")}`}
        </p>
      )}
      <div className="flex gap-2">
        {isFounder && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!title.trim() || update.isPending}
            onClick={() => update.mutate({ slug, userId: officer.userId, title, powers })}
          >
            Save
          </Button>
        )}
        {(isFounder || isSelf) && (
          <Button
            size="sm"
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ slug, userId: officer.userId })}
          >
            {isSelf ? "Resign" : "Remove"}
          </Button>
        )}
      </div>
    </li>
  );
}

function AppointOfficer({ slug }: { slug: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ userId: string; nation: string } | null>(null);
  const [title, setTitle] = useState("");
  const [powers, setPowers] = useState<RealmPower[]>([]);
  const { data: candidates } = api.realms.region.officerCandidates.useQuery(
    { slug, query },
    { enabled: picked === null }
  );
  const appoint = api.realms.region.appointOfficer.useMutation({
    onSuccess: () => {
      notify.success("Officer appointed");
      setPicked(null);
      setTitle("");
      setPowers([]);
      setQuery("");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not appoint", error.message),
  });

  return (
    <div className="bg-fill-4 rounded-row flex flex-col gap-3 p-4">
      <p className="text-label text-body font-medium">Appoint an officer</p>
      {picked ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-label text-body">{picked.nation}</span>
          <Button size="xs" variant="ghost" onClick={() => setPicked(null)}>
            Change
          </Button>
        </div>
      ) : (
        <>
          <SearchField
            size="sm"
            value={query}
            onValueChange={setQuery}
            placeholder="Find a nation of the realm"
            aria-label="Find a nation of the realm"
          />
          <ul className="flex max-h-40 flex-col overflow-y-auto">
            {(candidates ?? []).map((c) => (
              <li key={c.userId}>
                <button
                  type="button"
                  onClick={() => setPicked(c)}
                  className="hover:bg-fill-3 rounded-row text-label text-body w-full p-2 text-left"
                >
                  {c.nation}
                </button>
              </li>
            ))}
            {candidates?.length === 0 && (
              <li className="text-label-secondary text-footnote p-2">No nation owner matches.</li>
            )}
          </ul>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="officer-title">Title</Label>
        <Input
          id="officer-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Minister of Foreign Affairs"
          maxLength={60}
        />
      </div>
      <PowerChecks idPrefix="new-officer" value={powers} onChange={setPowers} />
      <div>
        <Button
          size="sm"
          disabled={!picked || !title.trim() || appoint.isPending}
          onClick={() => picked && appoint.mutate({ slug, userId: picked.userId, title, powers })}
        >
          Appoint
        </Button>
      </div>
    </div>
  );
}

/** Officers: the founder appoints them, names their title and grants powers; officers may resign. */
export function OfficersSection({ slug, manage }: { slug: string; manage: RealmManage }) {
  const { user } = useUser();
  return (
    <ManageSection
      id="officers"
      title="Officers"
      description={
        manage.isFounder
          ? `Appoint up to ${MAX_OFFICERS} players who own a nation here, with a title and the powers they need. Only you review claims and appoint officers.`
          : "The realm's officers. The founder appoints them and sets their powers."
      }
    >
      <div className="flex flex-col gap-4">
        {manage.officers.length === 0 ? (
          <p className="text-label-secondary text-body">No officers yet.</p>
        ) : (
          <ul className="divide-separator flex flex-col divide-y">
            {manage.officers.map((officer) => (
              <OfficerRow
                key={officer.userId}
                slug={slug}
                officer={officer}
                isFounder={manage.isFounder}
                isSelf={officer.userId === user?.id}
              />
            ))}
          </ul>
        )}
        {manage.isFounder && !manage.archived && manage.officers.length < MAX_OFFICERS && (
          <AppointOfficer slug={slug} />
        )}
      </div>
    </ManageSection>
  );
}
