import React from "react";
import { type PageType } from "../CreatePageModal";
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
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium tracking-wider text-[var(--wikios-text-muted)] uppercase">
          Template Metadata
        </label>
        <span className="text-[10px] text-[var(--wikios-text-dim)] italic">
          Optional - Skip to create
        </span>
      </div>

      <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
        {pageType === "person" && (
          <>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Birth Date</span>
              <input
                type="text"
                placeholder="e.g. 15 October 1985"
                value={personFields.birthDate}
                onChange={(e) => setPersonFields({ ...personFields, birthDate: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Birth Place</span>
              <input
                type="text"
                placeholder="e.g. London, United Kingdom"
                value={personFields.birthPlace}
                onChange={(e) => setPersonFields({ ...personFields, birthPlace: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Nationality</span>
              <input
                type="text"
                placeholder="e.g. British"
                value={personFields.nationality}
                onChange={(e) => setPersonFields({ ...personFields, nationality: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Occupation</span>
              <input
                type="text"
                placeholder="e.g. Economist"
                value={personFields.occupation}
                onChange={(e) => setPersonFields({ ...personFields, occupation: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
          </>
        )}

        {pageType === "company" && (
          <>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Company Type</span>
              <input
                type="text"
                placeholder="e.g. Public, Private"
                value={companyFields.type}
                onChange={(e) => setCompanyFields({ ...companyFields, type: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Industry</span>
              <input
                type="text"
                placeholder="e.g. Aerospace, Finance"
                value={companyFields.industry}
                onChange={(e) => setCompanyFields({ ...companyFields, industry: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Founder</span>
              <input
                type="text"
                placeholder="Founder names..."
                value={companyFields.founder}
                onChange={(e) => setCompanyFields({ ...companyFields, founder: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Headquarters</span>
              <input
                type="text"
                placeholder="e.g. Geneva, Switzerland"
                value={companyFields.headquarters}
                onChange={(e) =>
                  setCompanyFields({ ...companyFields, headquarters: e.target.value })
                }
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
          </>
        )}

        {pageType === "history" && (
          <>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Event Date</span>
              <input
                type="text"
                placeholder="e.g. June 19, 2026"
                value={historyFields.date}
                onChange={(e) => setHistoryFields({ ...historyFields, date: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Location</span>
              <input
                type="text"
                placeholder="e.g. Brussels, Belgium"
                value={historyFields.location}
                onChange={(e) => setHistoryFields({ ...historyFields, location: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Key Participants</span>
              <input
                type="text"
                placeholder="e.g. Allies, Axis"
                value={historyFields.participants}
                onChange={(e) =>
                  setHistoryFields({ ...historyFields, participants: e.target.value })
                }
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Result / Outcome</span>
              <input
                type="text"
                placeholder="e.g. Treaty signed"
                value={historyFields.result}
                onChange={(e) => setHistoryFields({ ...historyFields, result: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
          </>
        )}

        {pageType === "country" && (
          <>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Capital</span>
              <input
                type="text"
                placeholder="Capital city..."
                value={countryFields.capital}
                onChange={(e) => setCountryFields({ ...countryFields, capital: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Government Type</span>
              <input
                type="text"
                placeholder="e.g. Parliamentary Republic"
                value={countryFields.governmentType}
                onChange={(e) =>
                  setCountryFields({ ...countryFields, governmentType: e.target.value })
                }
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Leader Name</span>
              <input
                type="text"
                placeholder="Current leader..."
                value={countryFields.leaderName}
                onChange={(e) => setCountryFields({ ...countryFields, leaderName: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Currency</span>
              <input
                type="text"
                placeholder="e.g. Credits"
                value={countryFields.currency}
                onChange={(e) => setCountryFields({ ...countryFields, currency: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
          </>
        )}

        {pageType === "conflict" && (
          <>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Date</span>
              <input
                type="text"
                placeholder="e.g. 1939 - 1945"
                value={conflictFields.date}
                onChange={(e) => setConflictFields({ ...conflictFields, date: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Place</span>
              <input
                type="text"
                placeholder="e.g. Global"
                value={conflictFields.place}
                onChange={(e) => setConflictFields({ ...conflictFields, place: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Combatant 1</span>
              <input
                type="text"
                placeholder="Combatant group 1..."
                value={conflictFields.combatant1}
                onChange={(e) =>
                  setConflictFields({ ...conflictFields, combatant1: e.target.value })
                }
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Combatant 2</span>
              <input
                type="text"
                placeholder="Combatant group 2..."
                value={conflictFields.combatant2}
                onChange={(e) =>
                  setConflictFields({ ...conflictFields, combatant2: e.target.value })
                }
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
          </>
        )}

        {pageType === "politics" && (
          <>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Party Leader</span>
              <input
                type="text"
                placeholder="Leader name..."
                value={politicsFields.leader}
                onChange={(e) => setPoliticsFields({ ...politicsFields, leader: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Founder</span>
              <input
                type="text"
                placeholder="Founder name..."
                value={politicsFields.founder}
                onChange={(e) => setPoliticsFields({ ...politicsFields, founder: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Ideology</span>
              <input
                type="text"
                placeholder="e.g. Social Democracy"
                value={politicsFields.ideology}
                onChange={(e) => setPoliticsFields({ ...politicsFields, ideology: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">Party Colors</span>
              <input
                type="text"
                placeholder="e.g. Red and White"
                value={politicsFields.colors}
                onChange={(e) => setPoliticsFields({ ...politicsFields, colors: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
          </>
        )}

        {pageType === "tech" && (
          <>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">
                Inventor / Creator
              </span>
              <input
                type="text"
                placeholder="e.g. Alan Turing"
                value={techFields.inventor}
                onChange={(e) => setTechFields({ ...techFields, inventor: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">
                Year / Date of Invention
              </span>
              <input
                type="text"
                placeholder="e.g. 1936"
                value={techFields.year}
                onChange={(e) => setTechFields({ ...techFields, year: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--wikios-text-muted)]">
                Primary Application
              </span>
              <input
                type="text"
                placeholder="e.g. Computation"
                value={techFields.application}
                onChange={(e) => setTechFields({ ...techFields, application: e.target.value })}
                className="bg-foreground/[0.03] focus:bg-foreground/[0.06] w-full rounded-xl border border-[var(--wikios-border)] px-3 py-2 text-xs text-[var(--wikios-text)] placeholder-[var(--wikios-text-dim)] transition-all outline-none focus:border-[var(--wikios-accent)]/50"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
