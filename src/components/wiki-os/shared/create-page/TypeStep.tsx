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
import { type PageType } from "../CreatePageModal";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";

interface TypeStepProps {
  pageType: PageType;
  setPageType: (type: PageType) => void;
}

export function TypeStep({ pageType, setPageType }: TypeStepProps) {
  const items = [
    {
      id: "blank",
      label: "Blank page",
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
      label: "Military conflict",
      icon: ShieldAlert,
      desc: "Battles, combatants, commanders",
    },
    {
      id: "politics",
      label: "Political party",
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
      <RadioCardGroup
        aria-label="Page type"
        value={pageType}
        onValueChange={(v) => setPageType(v as PageType)}
        className="grid max-h-[45vh] scrollbar-thin grid-cols-2 gap-2 overflow-y-auto p-1"
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <RadioCard
              key={item.id}
              value={item.id}
              indicator={false}
              icon={<Icon className="size-4" />}
              title={item.label}
              description={item.desc}
              className="gap-2"
            />
          );
        })}
      </RadioCardGroup>
    </div>
  );
}
