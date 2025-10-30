import { HelpCircle, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

type SectionId = "demographics" | "fiscal" | "labor" | "spending" | "income" | "core";

export interface Section {
  key: SectionId;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface SectionNavigationProps {
  sections: Section[];
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
}

export function SectionNavigation({
  sections,
  activeSection,
  onSectionChange,
}: SectionNavigationProps) {
  return (
    <div className="mb-6 flex flex-wrap border-b border-[var(--color-border-primary)]">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.key;

        return (
          <Popover key={section.key}>
            <PopoverTrigger
              onClick={() => onSectionChange(section.key)}
              className={`flex items-center border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:border-[var(--color-border-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {section.label}
              <HelpCircle className="ml-1 h-3 w-3 opacity-60" />
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3">
              <div className="space-y-2">
                <h4 className="flex items-center font-medium text-[var(--color-text-primary)]">
                  <Icon className="mr-2 h-4 w-4" />
                  {section.label}
                </h4>
                <p className="text-sm text-[var(--color-text-muted)]">{section.description}</p>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
