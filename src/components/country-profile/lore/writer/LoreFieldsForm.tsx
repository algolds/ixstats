"use client";

import {
  CoordinateInputs,
  FieldRows,
  ORGANISATION_ROWS,
  PLACE_ROWS,
  type FieldRow,
} from "~/components/wiki-os/shared/create-page/MetadataStep";
import type {
  HistoryFields,
  PersonFields,
} from "~/components/wiki-os/shared/create-page/WikitextTemplates";
import type { LoreType } from "~/lib/lore/lore-types";
import type { LoreFields } from "./lore-prefill";

const PERSON_ROWS: readonly FieldRow<keyof PersonFields>[] = [
  { key: "birthDate", label: "Birth date", placeholder: "e.g. 12 March 1961" },
  { key: "birthPlace", label: "Birth place", placeholder: "e.g. Venceia" },
  { key: "nationality", label: "Nationality", placeholder: "e.g. Caphiric" },
  { key: "occupation", label: "Occupation", placeholder: "e.g. Consul" },
];

const EVENT_ROWS: readonly FieldRow<keyof HistoryFields>[] = [
  { key: "date", label: "Date", placeholder: "e.g. 1012" },
  { key: "location", label: "Location", placeholder: "e.g. Venceia" },
  { key: "participants", label: "Participants", placeholder: "e.g. The Senate, the Legions" },
  { key: "result", label: "Result", placeholder: "e.g. Treaty signed" },
];

function TypeFields({
  type,
  fields,
  onChange,
}: {
  type: Exclude<LoreType, "other">;
  fields: LoreFields;
  onChange: (next: LoreFields) => void;
}) {
  switch (type) {
    case "person":
      return (
        <FieldRows
          rows={PERSON_ROWS}
          value={fields.person}
          onChange={(person) => onChange({ ...fields, person })}
        />
      );
    case "place":
      return (
        <>
          <FieldRows
            rows={PLACE_ROWS}
            value={fields.place}
            onChange={(place) => onChange({ ...fields, place })}
          />
          <CoordinateInputs
            value={fields.place.coordinates}
            onChange={(coordinates) =>
              onChange({ ...fields, place: { ...fields.place, coordinates } })
            }
          />
        </>
      );
    case "event":
      return (
        <FieldRows
          rows={EVENT_ROWS}
          value={fields.event}
          onChange={(event) => onChange({ ...fields, event })}
        />
      );
    case "organisation":
      return (
        <FieldRows
          rows={ORGANISATION_ROWS}
          value={fields.organisation}
          onChange={(organisation) => onChange({ ...fields, organisation })}
        />
      );
  }
}

/** The infobox fields of the piece's type, all optional; Other has none. */
export function LoreFieldsForm({
  type,
  fields,
  onChange,
}: {
  type: LoreType;
  fields: LoreFields;
  onChange: (next: LoreFields) => void;
}) {
  if (type === "other") return null;
  return (
    <fieldset className="space-y-3">
      <legend className="text-subhead text-label-secondary mb-2">
        For the infobox, all optional
      </legend>
      <TypeFields type={type} fields={fields} onChange={onChange} />
    </fieldset>
  );
}
