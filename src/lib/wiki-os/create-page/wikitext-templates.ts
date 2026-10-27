/**
 * The WikiOS create flow's page types and the starting wikitext of each (its infobox and sections), shared by the
 * generic create sheet and the lore writer. Pure.
 */

export const PAGE_TYPES = [
  "blank",
  "person",
  "place",
  "organisation",
  "company",
  "history",
  "country",
  "conflict",
  "politics",
  "tech",
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export const isPageType = (value: string): value is PageType =>
  (PAGE_TYPES as readonly string[]).includes(value);

export interface PersonFields {
  birthDate: string;
  birthPlace: string;
  nationality: string;
  occupation: string;
}

export interface CompanyFields {
  type: string;
  industry: string;
  founder: string;
  headquarters: string;
}

export interface HistoryFields {
  date: string;
  location: string;
  participants: string;
  result: string;
}

export interface CountryFields {
  capital: string;
  governmentType: string;
  leaderName: string;
  currency: string;
}

export interface ConflictFields {
  date: string;
  place: string;
  combatant1: string;
  combatant2: string;
}

export interface PoliticsFields {
  leader: string;
  founder: string;
  ideology: string;
  colors: string;
}

export interface TechFields {
  inventor: string;
  year: string;
  application: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PlaceFields {
  settlementType: string;
  subdivision: string;
  /** Written as `{{coord|lat|lng}}`; left empty when absent or off the globe. */
  coordinates?: Coordinates;
  population: string;
}

export interface OrganisationFields {
  type: string;
  founded: string;
  headquarters: string;
  leader: string;
}

/** Every type's form fields; a group left out is empty. */
export interface TemplateFields {
  personFields: PersonFields;
  companyFields: CompanyFields;
  historyFields: HistoryFields;
  countryFields: CountryFields;
  conflictFields: ConflictFields;
  politicsFields: PoliticsFields;
  techFields: TechFields;
  placeFields: PlaceFields;
  organisationFields: OrganisationFields;
}

export interface GenerateWikitextOptions {
  /** Category names (without `Category:`), appended as one `[[Category:…]]` line each. */
  categories?: readonly string[];
}

export const EMPTY_TEMPLATE_FIELDS: TemplateFields = {
  personFields: { birthDate: "", birthPlace: "", nationality: "", occupation: "" },
  companyFields: { type: "", industry: "", founder: "", headquarters: "" },
  historyFields: { date: "", location: "", participants: "", result: "" },
  countryFields: { capital: "", governmentType: "", leaderName: "", currency: "" },
  conflictFields: { date: "", place: "", combatant1: "", combatant2: "" },
  politicsFields: { leader: "", founder: "", ideology: "", colors: "" },
  techFields: { inventor: "", year: "", application: "" },
  placeFields: { settlementType: "", subdivision: "", population: "" },
  organisationFields: { type: "", founded: "", headquarters: "", leader: "" },
};

/** A lore type's sections: headings only, no prose (the author writes the body). */
function loreSections(headings: readonly string[]): string {
  const sections = headings.map((heading) => `== ${heading} ==\n`).join("\n");
  return `${sections}\n== References ==\n<references />`;
}

/**
 * A typed field value as a template parameter's text: newlines collapse to spaces (a new line starting with `|`
 * would open a new parameter), template braces become entities and a pipe becomes `{{!}}`, so the value stays one
 * parameter and renders as typed. Braces go first: `{{!}}` is the one template this writes.
 */
function param(value: string): string {
  return value
    .replace(/\r\n?|\n/g, " ")
    .replaceAll("{{", "&#123;&#123;")
    .replaceAll("}}", "&#125;&#125;")
    .replaceAll("|", "{{!}}");
}

/** Typed latitude and longitude as a point: both must be numbers on the globe, else none. */
export function coordinatesFrom(lat: string, lng: string): Coordinates | undefined {
  if (lat.trim() === "" || lng.trim() === "") return undefined;
  const point = { lat: Number(lat), lng: Number(lng) };
  return isOnGlobe(point) ? point : undefined;
}

function isOnGlobe({ lat, lng }: Coordinates): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** `{{coord|lat|lng}}` for a point on the globe; empty otherwise. */
function coord(point: Coordinates | undefined): string {
  return point && isOnGlobe(point) ? `{{coord|${point.lat}|${point.lng}}}` : "";
}

type TemplateBuilder = (title: string, fields: TemplateFields) => string;

/** Each type's page text: its infobox and sections. A blank page has none. */
const TEMPLATES: Record<PageType, TemplateBuilder> = {
  blank: () => "",
  person: (title, { personFields: f }) => `{{Infobox person
| name          = ${title}
| image         = 
| caption       = 
| birth_date    = ${param(f.birthDate)}
| birth_place   = ${param(f.birthPlace)}
| nationality   = ${param(f.nationality)}
| occupation    = ${param(f.occupation)}
}}

${loreSections(["Early life", "Career", "Legacy"])}`,
  place: (title, { placeFields: f }) => `{{Infobox settlement
| name             = ${title}
| image_skyline    = 
| settlement_type  = ${param(f.settlementType)}
| subdivision_type = Subdivision
| subdivision_name = ${param(f.subdivision)}
| coordinates      = ${coord(f.coordinates)}
| population_total = ${param(f.population)}
}}

${loreSections(["History", "Geography", "Culture"])}`,
  history: (title, { historyFields: f }) => `{{Infobox event
| name          = ${title}
| image         = 
| caption       = 
| date          = ${param(f.date)}
| location      = ${param(f.location)}
| participants  = ${param(f.participants)}
| result        = ${param(f.result)}
}}

${loreSections(["Background", "Course", "Aftermath"])}`,
  organisation: (title, { organisationFields: f }) => `{{Infobox organization
| name          = ${title}
| image         = 
| type          = ${param(f.type)}
| founded       = ${param(f.founded)}
| headquarters  = ${param(f.headquarters)}
| leader_title  = Leader
| leader_name   = ${param(f.leader)}
}}

${loreSections(["History", "Structure", "Activities"])}`,
  company: (title, { companyFields: f }) => `{{Infobox company
| name          = ${title}
| logo          = 
| type          = ${param(f.type)}
| industry      = ${param(f.industry)}
| foundation    = 
| founder       = ${param(f.founder)}
| headquarters  = ${param(f.headquarters)}
| area_served   = 
| key_people    = 
| products      = 
| revenue       = 
| num_employees = 
}}

== History ==
Write corporate history here...

== Products and Services ==
Write products and services here...

== Operations ==
Write operations details here...

== See Also ==
* Related pages

== References ==
<references />`,
  country: (title, { countryFields: f }) => `{{Infobox country
| common_name   = ${title}
| image_flag    = 
| image_coat    = 
| national_anthem = 
| capital       = ${param(f.capital)}
| government_type = ${param(f.governmentType)}
| leader_title1 = Leader
| leader_name1  = ${param(f.leaderName)}
| population_estimate = 
| currency      = ${param(f.currency)}
}}

== Etymology ==
Write name origin here...

== History ==
Write history here...

== Geography ==
Write geography and climate details here...

== Government and Politics ==
Write government details here...

== Economy ==
Write economy details here...

== See Also ==
* Related pages

== References ==
<references />`,
  conflict: (title, { conflictFields: f }) => `{{Infobox military conflict
| conflict      = ${title}
| date          = ${param(f.date)}
| place         = ${param(f.place)}
| combatant1    = ${param(f.combatant1)}
| combatant2    = ${param(f.combatant2)}
}}

== Background ==
Write origin and causes here...

== Campaign ==
Write military campaigns and key battles here...

== Aftermath ==
Write peace terms and political outcome here...

== See Also ==
* Related pages

== References ==
<references />`,
  politics: (title, { politicsFields: f }) => `{{Infobox political party
| party_name     = ${title}
| leader         = ${param(f.leader)}
| founder        = ${param(f.founder)}
| ideology       = ${param(f.ideology)}
| colors         = ${param(f.colors)}
}}

== History ==
Write history details here...

== Ideology and Platforms ==
Write platform details here...

== Electoral Performance ==
Write electoral history here...

== See Also ==
* Related pages

== References ==
<references />`,
  tech: (title, { techFields: f }) => `{{Infobox invention
| name         = ${title}
| inventor     = ${param(f.inventor)}
| year         = ${param(f.year)}
| application  = ${param(f.application)}
}}

== Overview ==
Write overview and basic description here...

== Development History ==
Write research and development timeline here...

== Impact and Applications ==
Write impact details here...

== See Also ==
* Related pages

== References ==
<references />`,
};

/**
 * Link, template and tag markup, and a section anchor (`#`), cannot be part of a category name: `[[Category:…]]` must
 * stay one link to one category.
 */
const CATEGORY_MARKUP = /[[\]{}|#<>\r\n]/g;

/** One `[[Category:…]]` line per distinct, non-empty name, in order. */
function categoryLines(categories: readonly string[]): string {
  const names = categories.map((name) => name.replace(CATEGORY_MARKUP, "").trim()).filter(Boolean);
  return [...new Set(names)].map((name) => `[[Category:${name}]]`).join("\n");
}

/**
 * The starting wikitext of a new page of `pageType`: the type's infobox (from `fields`; a group left out is empty)
 * and section headings, then `options.categories` as category lines.
 */
export function generateWikitext(
  pageType: PageType,
  title: string,
  fields: Partial<TemplateFields>,
  options: GenerateWikitextOptions = {}
): string {
  const body = TEMPLATES[pageType](title, { ...EMPTY_TEMPLATE_FIELDS, ...fields });
  const categories = categoryLines(options.categories ?? []);
  if (!categories) return body;
  return body ? `${body}\n\n${categories}` : categories;
}
