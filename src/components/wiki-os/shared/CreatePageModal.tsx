"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Plus,
  Globe,
  User,
  Building,
  Clock,
  ShieldAlert,
  Sparkles,
  FileText,
  Landmark,
} from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";

interface CreatePageModalProps {
  open: boolean;
  onClose: () => void;
}

type PageType =
  | "blank"
  | "person"
  | "company"
  | "history"
  | "country"
  | "conflict"
  | "politics"
  | "tech";

export function CreatePageModal({ open, onClose }: CreatePageModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
  const [pageType, setPageType] = useState<PageType>("blank");
  const [existsWarning, setExistsWarning] = useState(false);

  // Form Fields
  const [personFields, setPersonFields] = useState({
    birthDate: "",
    birthPlace: "",
    nationality: "",
    occupation: "",
  });
  const [companyFields, setCompanyFields] = useState({
    type: "",
    industry: "",
    founder: "",
    headquarters: "",
  });
  const [historyFields, setHistoryFields] = useState({
    date: "",
    location: "",
    participants: "",
    result: "",
  });
  const [countryFields, setCountryFields] = useState({
    capital: "",
    governmentType: "",
    leaderName: "",
    currency: "",
  });
  const [conflictFields, setConflictFields] = useState({
    date: "",
    place: "",
    combatant1: "",
    combatant2: "",
  });
  const [politicsFields, setPoliticsFields] = useState({
    leader: "",
    founder: "",
    ideology: "",
    colors: "",
  });
  const [techFields, setTechFields] = useState({ inventor: "", year: "", application: "" });

  const inputRef = useRef<HTMLInputElement>(null);

  // Check exists query (refetched manually)
  const checkExists = api.wikios.checkPageExists.useQuery(
    { title: title.trim() },
    { enabled: false }
  );

  useEffect(() => {
    if (open) {
      setStep(1);
      setTitle("");
      setEditorMode("visual");
      setPageType("blank");
      setExistsWarning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleNext = async () => {
    if (!title.trim()) return;

    if (step === 1) {
      const res = await checkExists.refetch();
      if (res.data?.exists) {
        setExistsWarning(true);
        return;
      }
      setExistsWarning(false);
      setStep(2);
    } else if (step === 2) {
      if (pageType === "blank") {
        handleCreate();
      } else {
        setStep(3);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const generateWikitext = (): string => {
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
| conflict_name = ${title}
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
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    const wikitext = generateWikitext();
    onClose();

    const encodedTitle = encodeURIComponent(title.trim().replace(/ /g, "_"));
    const prefillParam = wikitext ? `&prefill=${encodeURIComponent(wikitext)}` : "";
    router.push(withBasePath(`/wiki/${encodedTitle}/edit?mode=${editorMode}${prefillParam}`));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-900/90 p-6 text-white shadow-2xl backdrop-blur-xl transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-semibold tracking-wide text-white">Create Wiki Page</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wider text-zinc-400 uppercase">
                Page Title
              </label>
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setExistsWarning(false);
                }}
                placeholder="Enter article title..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-all outline-none focus:border-emerald-500/50 focus:bg-white/10"
              />
              {existsWarning && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-semibold">Page already exists!</span> You can{" "}
                    <button
                      onClick={() => {
                        onClose();
                        router.push(
                          withBasePath(
                            `/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`
                          )
                        );
                      }}
                      className="font-medium text-white underline hover:text-emerald-400"
                    >
                      view
                    </button>{" "}
                    or{" "}
                    <button
                      onClick={() => {
                        onClose();
                        router.push(
                          withBasePath(
                            `/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}/edit`
                          )
                        );
                      }}
                      className="font-medium text-white underline hover:text-emerald-400"
                    >
                      edit
                    </button>{" "}
                    it instead.
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium tracking-wider text-zinc-400 uppercase">
                Preferred Editor
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditorMode("visual")}
                  className={cn(
                    "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
                    editorMode === "visual"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                      : "border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10"
                  )}
                >
                  <span className="text-xs font-semibold text-white">Visual Editor</span>
                  <span className="mt-0.5 text-[10px] text-zinc-500">
                    Edit rich layout directly
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("source")}
                  className={cn(
                    "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
                    editorMode === "source"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                      : "border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10"
                  )}
                >
                  <span className="text-xs font-semibold text-white">Source Editor</span>
                  <span className="mt-0.5 text-[10px] text-zinc-500">
                    Wikitext markup / CodeMirror
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <label className="block text-xs font-medium tracking-wider text-zinc-400 uppercase">
              Select Page Type
            </label>
            <div className="grid max-h-[45vh] scrollbar-thin grid-cols-2 gap-2 overflow-y-auto pr-1">
              {[
                {
                  id: "blank",
                  label: "Blank Page",
                  icon: FileText,
                  desc: "Plain start without preset templates",
                },
                {
                  id: "person",
                  label: "Person",
                  icon: User,
                  desc: "Biography, career info & infobox",
                },
                {
                  id: "company",
                  label: "Company",
                  icon: Building,
                  desc: "Organization details, founder, revenue",
                },
                {
                  id: "history",
                  label: "History / Event",
                  icon: Clock,
                  desc: "Historic event timeline and results",
                },
                {
                  id: "country",
                  label: "Country",
                  icon: Globe,
                  desc: "Capital, government, currency & flag",
                },
                {
                  id: "conflict",
                  label: "Military Conflict",
                  icon: ShieldAlert,
                  desc: "Battles, combatants, commanders",
                },
                {
                  id: "politics",
                  label: "Political Party",
                  icon: Landmark,
                  desc: "Ideology, leaders, voter stats",
                },
                {
                  id: "tech",
                  label: "Technology",
                  icon: Sparkles,
                  desc: "Inventions, specifications, developer",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPageType(item.id as PageType)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all",
                      pageType === item.id
                        ? "border-emerald-500/50 bg-emerald-500/10 text-white"
                        : "border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10"
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4",
                        pageType === item.id ? "text-emerald-400" : "text-zinc-500"
                      )}
                    />
                    <div>
                      <div className="text-xs font-semibold text-white">{item.label}</div>
                      <div className="mt-0.5 text-[9px] leading-tight text-zinc-500">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium tracking-wider text-zinc-400 uppercase">
                Template Metadata
              </label>
              <span className="text-[10px] text-zinc-500 italic">Optional - Skip to create</span>
            </div>

            <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {pageType === "person" && (
                <>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Birth Date</span>
                    <input
                      type="text"
                      placeholder="e.g. 15 October 1985"
                      value={personFields.birthDate}
                      onChange={(e) =>
                        setPersonFields({ ...personFields, birthDate: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Birth Place</span>
                    <input
                      type="text"
                      placeholder="e.g. London, United Kingdom"
                      value={personFields.birthPlace}
                      onChange={(e) =>
                        setPersonFields({ ...personFields, birthPlace: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Nationality</span>
                    <input
                      type="text"
                      placeholder="e.g. British"
                      value={personFields.nationality}
                      onChange={(e) =>
                        setPersonFields({ ...personFields, nationality: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Occupation</span>
                    <input
                      type="text"
                      placeholder="e.g. Economist"
                      value={personFields.occupation}
                      onChange={(e) =>
                        setPersonFields({ ...personFields, occupation: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                </>
              )}

              {pageType === "company" && (
                <>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Company Type</span>
                    <input
                      type="text"
                      placeholder="e.g. Public, Private"
                      value={companyFields.type}
                      onChange={(e) => setCompanyFields({ ...companyFields, type: e.target.value })}
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Industry</span>
                    <input
                      type="text"
                      placeholder="e.g. Aerospace, Finance"
                      value={companyFields.industry}
                      onChange={(e) =>
                        setCompanyFields({ ...companyFields, industry: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Founder</span>
                    <input
                      type="text"
                      placeholder="Founder names..."
                      value={companyFields.founder}
                      onChange={(e) =>
                        setCompanyFields({ ...companyFields, founder: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Headquarters</span>
                    <input
                      type="text"
                      placeholder="e.g. Geneva, Switzerland"
                      value={companyFields.headquarters}
                      onChange={(e) =>
                        setCompanyFields({ ...companyFields, headquarters: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                </>
              )}

              {pageType === "history" && (
                <>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Event Date</span>
                    <input
                      type="text"
                      placeholder="e.g. June 19, 2026"
                      value={historyFields.date}
                      onChange={(e) => setHistoryFields({ ...historyFields, date: e.target.value })}
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Location</span>
                    <input
                      type="text"
                      placeholder="e.g. Brussels, Belgium"
                      value={historyFields.location}
                      onChange={(e) =>
                        setHistoryFields({ ...historyFields, location: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Key Participants</span>
                    <input
                      type="text"
                      placeholder="e.g. Allies, Axis"
                      value={historyFields.participants}
                      onChange={(e) =>
                        setHistoryFields({ ...historyFields, participants: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Result / Outcome</span>
                    <input
                      type="text"
                      placeholder="e.g. Treaty signed"
                      value={historyFields.result}
                      onChange={(e) =>
                        setHistoryFields({ ...historyFields, result: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                </>
              )}

              {pageType === "country" && (
                <>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Capital</span>
                    <input
                      type="text"
                      placeholder="Capital city..."
                      value={countryFields.capital}
                      onChange={(e) =>
                        setCountryFields({ ...countryFields, capital: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Government Type</span>
                    <input
                      type="text"
                      placeholder="e.g. Parliamentary Republic"
                      value={countryFields.governmentType}
                      onChange={(e) =>
                        setCountryFields({ ...countryFields, governmentType: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Leader Name</span>
                    <input
                      type="text"
                      placeholder="Current leader..."
                      value={countryFields.leaderName}
                      onChange={(e) =>
                        setCountryFields({ ...countryFields, leaderName: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Currency</span>
                    <input
                      type="text"
                      placeholder="e.g. Credits"
                      value={countryFields.currency}
                      onChange={(e) =>
                        setCountryFields({ ...countryFields, currency: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                </>
              )}

              {pageType === "conflict" && (
                <>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Date</span>
                    <input
                      type="text"
                      placeholder="e.g. 1939 - 1945"
                      value={conflictFields.date}
                      onChange={(e) =>
                        setConflictFields({ ...conflictFields, date: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Place</span>
                    <input
                      type="text"
                      placeholder="e.g. Global"
                      value={conflictFields.place}
                      onChange={(e) =>
                        setConflictFields({ ...conflictFields, place: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Combatant 1</span>
                    <input
                      type="text"
                      placeholder="Combatant group 1..."
                      value={conflictFields.combatant1}
                      onChange={(e) =>
                        setConflictFields({ ...conflictFields, combatant1: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Combatant 2</span>
                    <input
                      type="text"
                      placeholder="Combatant group 2..."
                      value={conflictFields.combatant2}
                      onChange={(e) =>
                        setConflictFields({ ...conflictFields, combatant2: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                </>
              )}

              {pageType === "politics" && (
                <>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Party Leader</span>
                    <input
                      type="text"
                      placeholder="Leader name..."
                      value={politicsFields.leader}
                      onChange={(e) =>
                        setPoliticsFields({ ...politicsFields, leader: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Founder</span>
                    <input
                      type="text"
                      placeholder="Founder name..."
                      value={politicsFields.founder}
                      onChange={(e) =>
                        setPoliticsFields({ ...politicsFields, founder: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Ideology</span>
                    <input
                      type="text"
                      placeholder="e.g. Social Democracy"
                      value={politicsFields.ideology}
                      onChange={(e) =>
                        setPoliticsFields({ ...politicsFields, ideology: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Party Colors</span>
                    <input
                      type="text"
                      placeholder="e.g. Red and White"
                      value={politicsFields.colors}
                      onChange={(e) =>
                        setPoliticsFields({ ...politicsFields, colors: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                </>
              )}

              {pageType === "tech" && (
                <>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Inventor / Creator</span>
                    <input
                      type="text"
                      placeholder="e.g. Alan Turing"
                      value={techFields.inventor}
                      onChange={(e) => setTechFields({ ...techFields, inventor: e.target.value })}
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Year / Date of Invention</span>
                    <input
                      type="text"
                      placeholder="e.g. 1936"
                      value={techFields.year}
                      onChange={(e) => setTechFields({ ...techFields, year: e.target.value })}
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Primary Application</span>
                    <input
                      type="text"
                      placeholder="e.g. Computation"
                      value={techFields.application}
                      onChange={(e) =>
                        setTechFields({ ...techFields, application: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/30"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-white"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={
                step === 3 || (step === 2 && pageType === "blank") ? handleCreate : handleNext
              }
              disabled={!title.trim() || checkExists.isFetching}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-500 active:scale-95 disabled:scale-100 disabled:opacity-50"
            >
              {checkExists.isFetching ? (
                <span>Checking...</span>
              ) : step === 3 || (step === 2 && pageType === "blank") ? (
                <>
                  <Plus size={14} />
                  <span>Create Page</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
