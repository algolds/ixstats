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
      <label className="block text-xs font-medium tracking-wider text-[var(--wikios-text-muted)] uppercase">
        Select Page Type
      </label>
      <div className="grid max-h-[45vh] scrollbar-thin grid-cols-2 gap-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPageType(item.id as PageType)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all",
                pageType === item.id
                  ? "border-[var(--wikios-accent)] bg-[var(--wikios-accent)]/[0.08] text-[var(--wikios-text)]"
                  : "bg-foreground/[0.03] hover:bg-foreground/[0.06] border-[var(--wikios-border)] text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4",
                  pageType === item.id
                    ? "text-[var(--wikios-accent)]"
                    : "text-[var(--wikios-text-dim)]"
                )}
              />
              <div>
                <div className="text-xs font-semibold text-[var(--wikios-text)]">{item.label}</div>
                <div className="mt-0.5 text-[9px] leading-tight text-[var(--wikios-text-dim)]">
                  {item.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
