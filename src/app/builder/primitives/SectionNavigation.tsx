import { HelpCircle, LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

export interface Section {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface SectionNavigationProps {
  sections: Section[];
  activeSection: "demographics" | "fiscal" | "labor" | "spending" | "income" | "core";
  onSectionChange: (section: "demographics" | "fiscal" | "labor" | "spending" | "income" | "core") => void;
}

export function SectionNavigation({ sections, activeSection, onSectionChange }: SectionNavigationProps) {
  return (
    <div className="flex flex-wrap border-b border-[var(--color-border-primary)] mb-6">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.key;
        
        return (
          <Popover key={section.key}>
            <PopoverTrigger 
              onClick={() => onSectionChange(section.key)}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-secondary)]'
              }`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {section.label}
              <HelpCircle className="h-3 w-3 ml-1 opacity-60" />
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3">
              <div className="space-y-2">
                <h4 className="font-medium text-[var(--color-text-primary)] flex items-center">
                  <Icon className="h-4 w-4 mr-2" />
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