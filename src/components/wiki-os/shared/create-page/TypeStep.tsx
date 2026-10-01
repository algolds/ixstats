import {
  Page as FileText,
  User,
  Building,
  Clock,
  Globe,
  ShieldAlert,
  Bank as Landmark,
  Sparks as Sparkles,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { type PageType } from "../CreatePageModal";

interface TypeStepProps {
  pageType: PageType;
  setPageType: (type: PageType) => void;
}

export function TypeStep({ pageType, setPageType }: TypeStepProps) {
  const items = [
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
  ];

  return (
    <div className="space-y-3">
      <p className="text-subhead text-label-secondary">Select page type</p>
      <div className="grid max-h-[45vh] scrollbar-thin grid-cols-2 gap-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={pageType === item.id}
              onClick={() => setPageType(item.id as PageType)}
              className={cn(
                "rounded-row duration-fast flex items-start gap-2 border p-3 text-left transition-colors",
                pageType === item.id
                  ? "border-tint bg-tint-fill text-label"
                  : "border-separator bg-fill-4 text-label-secondary hover:bg-fill-3"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  pageType === item.id ? "text-tint" : "text-label-secondary"
                )}
              />
              <div>
                <div className="text-headline text-label">{item.label}</div>
                <div className="text-footnote text-label-secondary mt-0.5">{item.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
