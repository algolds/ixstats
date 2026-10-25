/**
 * The lore writer's starting text (docs/superpowers/specs/2026-10-24-native-lore-design.md, "Writing flow"): the
 * create flow's template for the piece's type, filled from the writer's form, then the country's lore category and
 * its own category. Field values go in raw: `generateWikitext` escapes them. Pure.
 */
import { loreCategory, type LoreType } from "./lore-types";
import {
  EMPTY_TEMPLATE_FIELDS,
  generateWikitext,
  type HistoryFields,
  type OrganisationFields,
  type PageType,
  type PersonFields,
  type PlaceFields,
} from "~/lib/wiki-os/create-page/wikitext-templates";

/** The create flow's template each lore type is written with; Other has none (category lines only). */
export const LORE_PAGE_TYPE: Readonly<Record<LoreType, PageType>> = {
  person: "person",
  place: "place",
  event: "history",
  organisation: "organisation",
  other: "blank",
};

/** The writer's form: one group of infobox fields per type that has an infobox. */
export interface LoreFields {
  person: PersonFields;
  place: PlaceFields;
  event: HistoryFields;
  organisation: OrganisationFields;
}

export const EMPTY_LORE_FIELDS: LoreFields = {
  person: EMPTY_TEMPLATE_FIELDS.personFields,
  place: EMPTY_TEMPLATE_FIELDS.placeFields,
  event: EMPTY_TEMPLATE_FIELDS.historyFields,
  organisation: EMPTY_TEMPLATE_FIELDS.organisationFields,
};

/** What an entry point already knows: a map place (its point and subdivision) or a History entry's date. */
export interface LoreFieldSeed {
  place?: { lng: number; lat: number; subdivision?: string };
  date?: string;
}

export function seedLoreFields(seed: LoreFieldSeed | undefined): LoreFields {
  const place = seed?.place;
  return {
    ...EMPTY_LORE_FIELDS,
    place: place
      ? {
          ...EMPTY_LORE_FIELDS.place,
          subdivision: place.subdivision ?? "",
          coordinates: { lat: place.lat, lng: place.lng },
        }
      : EMPTY_LORE_FIELDS.place,
    event: { ...EMPTY_LORE_FIELDS.event, date: seed?.date ?? "" },
  };
}

export function lorePrefill(
  type: LoreType,
  title: string,
  fields: LoreFields,
  countryName: string
): string {
  return generateWikitext(
    LORE_PAGE_TYPE[type],
    title,
    {
      personFields: fields.person,
      placeFields: fields.place,
      historyFields: fields.event,
      organisationFields: fields.organisation,
    },
    { categories: [loreCategory(countryName), countryName.replace(/_/g, " ")] }
  );
}
