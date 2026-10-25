import { type PageType } from "../CreatePageModal";

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

export interface PlaceFields {
  settlementType: string;
  subdivision: string;
  coordinates: string;
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
  placeFields: { settlementType: "", subdivision: "", coordinates: "", population: "" },
  organisationFields: { type: "", founded: "", headquarters: "", leader: "" },
};

/** A lore type's sections: headings only, no prose (the author writes the body). */
function loreSections(headings: readonly string[]): string {
  const sections = headings.map((heading) => `== ${heading} ==\n`).join("\n");
  return `${sections}\n== References ==\n<references />`;
}

type TemplateBuilder = (title: string, fields: TemplateFields) => string;

/** Each type's page text: its infobox and sections. A blank page has none. */
const TEMPLATES: Record<PageType, TemplateBuilder> = {
  blank: () => "",
  person: (title, { personFields: f }) => `{{Infobox person
| name          = ${title}
| image         = 
| caption       = 
| birth_date    = ${f.birthDate}
| birth_place   = ${f.birthPlace}
| nationality   = ${f.nationality}
| occupation    = ${f.occupation}
}}

${loreSections(["Early life", "Career", "Legacy"])}`,
  place: (title, { placeFields: f }) => `{{Infobox settlement
| name             = ${title}
| image_skyline    = 
| settlement_type  = ${f.settlementType}
| subdivision_type = Subdivision
| subdivision_name = ${f.subdivision}
| coordinates      = ${f.coordinates}
| population_total = ${f.population}
}}

${loreSections(["History", "Geography", "Culture"])}`,
  history: (title, { historyFields: f }) => `{{Infobox event
| name          = ${title}
| image         = 
| caption       = 
| date          = ${f.date}
| location      = ${f.location}
| participants  = ${f.participants}
| result        = ${f.result}
}}

${loreSections(["Background", "Course", "Aftermath"])}`,
  organisation: (title, { organisationFields: f }) => `{{Infobox organization
| name          = ${title}
| image         = 
| type          = ${f.type}
| founded       = ${f.founded}
| headquarters  = ${f.headquarters}
| leader_title  = Leader
| leader_name   = ${f.leader}
}}

${loreSections(["History", "Structure", "Activities"])}`,
  company: (title, { companyFields: f }) => `{{Infobox company
| name          = ${title}
| logo          = 
| type          = ${f.type}
| industry      = ${f.industry}
| foundation    = 
| founder       = ${f.founder}
| headquarters  = ${f.headquarters}
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
| capital       = ${f.capital}
| government_type = ${f.governmentType}
| leader_title1 = Leader
| leader_name1  = ${f.leaderName}
| population_estimate = 
| currency      = ${f.currency}
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
| date          = ${f.date}
| place         = ${f.place}
| combatant1    = ${f.combatant1}
| combatant2    = ${f.combatant2}
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
| leader         = ${f.leader}
| founder        = ${f.founder}
| ideology       = ${f.ideology}
| colors         = ${f.colors}
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
| inventor     = ${f.inventor}
| year         = ${f.year}
| application  = ${f.application}
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

/** Link and template markup cannot be part of a category name: `[[Category:…]]` must stay one link. */
const CATEGORY_MARKUP = /[[\]{}|\r\n]/g;

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
