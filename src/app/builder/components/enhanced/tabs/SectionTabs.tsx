import type { ComponentType } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface SectionTabsProps<T extends string> {
  sections: readonly { id: T; label: string; icon: ComponentType<{ className?: string }> }[];
  active: T;
  onChange: (id: T) => void;
}

/** The pill tab bar that switches a builder tab between its sections. */
export function SectionTabs<T extends string>({ sections, active, onChange }: SectionTabsProps<T>) {
  return (
    <div className="border-separator bg-fill-4 rounded-row flex space-x-1 border p-1 shadow-inner">
      {sections.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          variant={active === id ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(id)}
          className={cn(
            "rounded-control flex-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-205",
            active === id
              ? "bg-green text-on-green shadow-card hover:bg-green"
              : "text-label-secondary hover:bg-fill-3 hover:text-label"
          )}
        >
          <Icon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}
