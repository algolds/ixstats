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

export function generateWikitext(
  pageType: PageType,
  title: string,
  fields: {
    personFields: PersonFields;
    companyFields: CompanyFields;
    historyFields: HistoryFields;
    countryFields: CountryFields;
    conflictFields: ConflictFields;
    politicsFields: PoliticsFields;
    techFields: TechFields;
  }
): string {
  const {
    personFields,
    companyFields,
    historyFields,
    countryFields,
    conflictFields,
    politicsFields,
    techFields,
  } = fields;

  switch (pageType) {
    case "person":
      return `{{Infobox person
| name          = ${title}
| image         = 
| caption       = 
| birth_date    = ${personFields.birthDate}
| birth_place   = ${personFields.birthPlace}
| nationality   = ${personFields.nationality}
| occupation    = ${personFields.occupation}
}}

== Biography ==
Write biography details here...

== Career ==
Write career details here...

== Personal Life ==
Write personal life details here...

== See Also ==
* Related pages

== References ==
<references />`;
    case "company":
      return `{{Infobox company
| name          = ${title}
| logo          = 
| type          = ${companyFields.type}
| industry      = ${companyFields.industry}
| foundation    = 
| founder       = ${companyFields.founder}
| headquarters  = ${companyFields.headquarters}
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
<references />`;
    case "history":
      return `{{Infobox historical event
| event_name    = ${title}
| image         = 
| caption       = 
| date          = ${historyFields.date}
| location      = ${historyFields.location}
| result        = ${historyFields.result}
| participants  = ${historyFields.participants}
}}

== Background ==
Write background details here...

== The Event ==
Write details of the event here...

== Aftermath ==
Write aftermath details here...

== Legacy ==
Write significance and legacy here...

== See Also ==
* Related pages

== References ==
<references />`;
    case "country":
      return `{{Infobox country
| common_name   = ${title}
| image_flag    = 
| image_coat    = 
| national_anthem = 
| capital       = ${countryFields.capital}
| government_type = ${countryFields.governmentType}
| leader_title1 = Leader
| leader_name1  = ${countryFields.leaderName}
| population_estimate = 
| currency      = ${countryFields.currency}
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
<references />`;
    case "conflict":
      return `{{Infobox military conflict
| conflict      = ${title}
| date          = ${conflictFields.date}
| place         = ${conflictFields.place}
| combatant1    = ${conflictFields.combatant1}
| combatant2    = ${conflictFields.combatant2}
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
<references />`;
    case "politics":
      return `{{Infobox political party
| party_name     = ${title}
| leader         = ${politicsFields.leader}
| founder        = ${politicsFields.founder}
| ideology       = ${politicsFields.ideology}
| colors         = ${politicsFields.colors}
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
<references />`;
    case "tech":
      return `{{Infobox invention
| name         = ${title}
| inventor     = ${techFields.inventor}
| year         = ${techFields.year}
| application  = ${techFields.application}
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
<references />`;
    default:
      return "";
  }
}
