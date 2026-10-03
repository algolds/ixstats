import React from "react";
import { type PageType } from "../CreatePageModal";
import { Input } from "~/components/ui/input";
import {
  type PersonFields,
  type CompanyFields,
  type HistoryFields,
  type CountryFields,
  type ConflictFields,
  type PoliticsFields,
  type TechFields,
} from "./WikitextTemplates";

interface MetadataStepProps {
  pageType: PageType;
  personFields: PersonFields;
  setPersonFields: (fields: PersonFields) => void;
  companyFields: CompanyFields;
  setCompanyFields: (fields: CompanyFields) => void;
  historyFields: HistoryFields;
  setHistoryFields: (fields: HistoryFields) => void;
  countryFields: CountryFields;
  setCountryFields: (fields: CountryFields) => void;
  conflictFields: ConflictFields;
  setConflictFields: (fields: ConflictFields) => void;
  politicsFields: PoliticsFields;
  setPoliticsFields: (fields: PoliticsFields) => void;
  techFields: TechFields;
  setTechFields: (fields: TechFields) => void;
}

export function MetadataStep({
  pageType,
  personFields,
  setPersonFields,
  companyFields,
  setCompanyFields,
  historyFields,
  setHistoryFields,
  countryFields,
  setCountryFields,
  conflictFields,
  setConflictFields,
  politicsFields,
  setPoliticsFields,
  techFields,
  setTechFields,
}: MetadataStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-subhead text-label-secondary block">Template metadata</label>
        <span className="text-footnote text-label-secondary italic">Optional - Skip to create</span>
      </div>

      <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
        {pageType === "person" && (
          <>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Birth date</span>
              <Input
                type="text"
                placeholder="e.g. 15 October 1985"
                value={personFields.birthDate}
                onChange={(e) => setPersonFields({ ...personFields, birthDate: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Birth place</span>
              <Input
                type="text"
                placeholder="e.g. London, United Kingdom"
                value={personFields.birthPlace}
                onChange={(e) => setPersonFields({ ...personFields, birthPlace: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Nationality</span>
              <Input
                type="text"
                placeholder="e.g. British"
                value={personFields.nationality}
                onChange={(e) => setPersonFields({ ...personFields, nationality: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Occupation</span>
              <Input
                type="text"
                placeholder="e.g. Economist"
                value={personFields.occupation}
                onChange={(e) => setPersonFields({ ...personFields, occupation: e.target.value })}
              />
            </label>
          </>
        )}

        {pageType === "company" && (
          <>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Company type</span>
              <Input
                type="text"
                placeholder="e.g. Public, Private"
                value={companyFields.type}
                onChange={(e) => setCompanyFields({ ...companyFields, type: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Industry</span>
              <Input
                type="text"
                placeholder="e.g. Aerospace, Finance"
                value={companyFields.industry}
                onChange={(e) => setCompanyFields({ ...companyFields, industry: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Founder</span>
              <Input
                type="text"
                placeholder="Founder names..."
                value={companyFields.founder}
                onChange={(e) => setCompanyFields({ ...companyFields, founder: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Headquarters</span>
              <Input
                type="text"
                placeholder="e.g. Geneva, Switzerland"
                value={companyFields.headquarters}
                onChange={(e) =>
                  setCompanyFields({ ...companyFields, headquarters: e.target.value })
                }
              />
            </label>
          </>
        )}

        {pageType === "history" && (
          <>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Event date</span>
              <Input
                type="text"
                placeholder="e.g. June 19, 2026"
                value={historyFields.date}
                onChange={(e) => setHistoryFields({ ...historyFields, date: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Location</span>
              <Input
                type="text"
                placeholder="e.g. Brussels, Belgium"
                value={historyFields.location}
                onChange={(e) => setHistoryFields({ ...historyFields, location: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Key participants</span>
              <Input
                type="text"
                placeholder="e.g. Allies, Axis"
                value={historyFields.participants}
                onChange={(e) =>
                  setHistoryFields({ ...historyFields, participants: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Result / Outcome</span>
              <Input
                type="text"
                placeholder="e.g. Treaty signed"
                value={historyFields.result}
                onChange={(e) => setHistoryFields({ ...historyFields, result: e.target.value })}
              />
            </label>
          </>
        )}

        {pageType === "country" && (
          <>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Capital</span>
              <Input
                type="text"
                placeholder="Capital city..."
                value={countryFields.capital}
                onChange={(e) => setCountryFields({ ...countryFields, capital: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Government type</span>
              <Input
                type="text"
                placeholder="e.g. Parliamentary Republic"
                value={countryFields.governmentType}
                onChange={(e) =>
                  setCountryFields({ ...countryFields, governmentType: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Leader name</span>
              <Input
                type="text"
                placeholder="Current leader..."
                value={countryFields.leaderName}
                onChange={(e) => setCountryFields({ ...countryFields, leaderName: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Currency</span>
              <Input
                type="text"
                placeholder="e.g. Credits"
                value={countryFields.currency}
                onChange={(e) => setCountryFields({ ...countryFields, currency: e.target.value })}
              />
            </label>
          </>
        )}

        {pageType === "conflict" && (
          <>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Date</span>
              <Input
                type="text"
                placeholder="e.g. 1939 - 1945"
                value={conflictFields.date}
                onChange={(e) => setConflictFields({ ...conflictFields, date: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Place</span>
              <Input
                type="text"
                placeholder="e.g. Global"
                value={conflictFields.place}
                onChange={(e) => setConflictFields({ ...conflictFields, place: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Combatant 1</span>
              <Input
                type="text"
                placeholder="Combatant group 1..."
                value={conflictFields.combatant1}
                onChange={(e) =>
                  setConflictFields({ ...conflictFields, combatant1: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Combatant 2</span>
              <Input
                type="text"
                placeholder="Combatant group 2..."
                value={conflictFields.combatant2}
                onChange={(e) =>
                  setConflictFields({ ...conflictFields, combatant2: e.target.value })
                }
              />
            </label>
          </>
        )}

        {pageType === "politics" && (
          <>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Party leader</span>
              <Input
                type="text"
                placeholder="Leader name..."
                value={politicsFields.leader}
                onChange={(e) => setPoliticsFields({ ...politicsFields, leader: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Founder</span>
              <Input
                type="text"
                placeholder="Founder name..."
                value={politicsFields.founder}
                onChange={(e) => setPoliticsFields({ ...politicsFields, founder: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Ideology</span>
              <Input
                type="text"
                placeholder="e.g. Social Democracy"
                value={politicsFields.ideology}
                onChange={(e) => setPoliticsFields({ ...politicsFields, ideology: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-footnote text-label-secondary">Party colors</span>
              <Input
                type="text"
                placeholder="e.g. Red and White"
                value={politicsFields.colors}
                onChange={(e) => setPoliticsFields({ ...politicsFields, colors: e.target.value })}
              />
            </label>
          </>
        )}

        {pageType === "tech" && (
          <>
            <div className="space-y-1">
              <span className="text-footnote text-label-secondary">Inventor / Creator</span>
              <Input
                type="text"
                placeholder="e.g. Alan Turing"
                value={techFields.inventor}
                onChange={(e) => setTechFields({ ...techFields, inventor: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <span className="text-footnote text-label-secondary">Year / Date of Invention</span>
              <Input
                type="text"
                placeholder="e.g. 1936"
                value={techFields.year}
                onChange={(e) => setTechFields({ ...techFields, year: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <span className="text-footnote text-label-secondary">Primary application</span>
              <Input
                type="text"
                placeholder="e.g. Computation"
                value={techFields.application}
                onChange={(e) => setTechFields({ ...techFields, application: e.target.value })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
