/**
 * Template Selector
 *
 * Dropdown to select preset government templates.
 * Optimized with React.memo for performance.
 *
 * @module TemplateSelector
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import {
  FileText,
  FlaskConical,
  Globe2,
  Heart,
  Landmark,
  LifeBuoy,
  ChevronDown,
  ChevronRight,
  Shield,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { ComponentType } from "~/lib/enums";

export interface GovernmentTemplate {
  name: string;
  description: string;
  components: readonly ComponentType[];
}

export interface TemplateSelectorProps {
  templates: Record<string, GovernmentTemplate>;
  onSelect: (templateId: string) => void;
  disabled?: boolean;
}

type TemplateGroupId =
  | "democratic"
  | "technocratic"
  | "security"
  | "social"
  | "economic"
  | "diplomatic"
  | "resilience";

interface TemplateGroupConfig {
  id: TemplateGroupId;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  keywords: string[];
}

const TEMPLATE_GROUP_CONFIG: readonly TemplateGroupConfig[] = [
  {
    id: "democratic",
    label: "Democratic & Institutional",
    icon: Landmark,
    iconClassName: "text-blue-600 dark:text-blue-400",
    keywords: [
      "democracy",
      "republic",
      "parliamentary",
      "constitutional",
      "civic",
      "consensus",
      "decentralized",
      "legalist",
      "rights",
    ],
  },
  {
    id: "technocratic",
    label: "Technocratic & Digital",
    icon: FlaskConical,
    iconClassName: "text-indigo-600 dark:text-indigo-400",
    keywords: [
      "technocracy",
      "technocratic",
      "data_driven",
      "innovation_bureaucracy",
      "strategic",
      "quality",
      "smart_city",
      "performance",
      "digital",
    ],
  },
  {
    id: "security",
    label: "Security & Command",
    icon: Shield,
    iconClassName: "text-red-600 dark:text-red-400",
    keywords: [
      "authoritarian",
      "security_state",
      "command_economy",
      "surveillance",
      "militarized",
      "crisis_command",
      "autocratic",
      "centralized_emergency",
    ],
  },
  {
    id: "social",
    label: "Social & Welfare",
    icon: Heart,
    iconClassName: "text-rose-600 dark:text-rose-400",
    keywords: [
      "welfare",
      "social_",
      "green_welfare",
      "worker",
      "public_service",
      "inclusive",
      "community_resilience",
    ],
  },
  {
    id: "economic",
    label: "Economic & Innovation",
    icon: TrendingUp,
    iconClassName: "text-emerald-600 dark:text-emerald-400",
    keywords: [
      "innovation_hub",
      "market",
      "mixed_economy",
      "corporatist",
      "resource",
      "startup",
      "knowledge",
      "trade_growth",
      "industrial_transition",
    ],
  },
  {
    id: "diplomatic",
    label: "Diplomatic & Global",
    icon: Globe2,
    iconClassName: "text-cyan-600 dark:text-cyan-400",
    keywords: [
      "multilateral",
      "regional",
      "humanitarian",
      "alliance",
      "global_rule_of_law",
      "development_partner",
    ],
  },
  {
    id: "resilience",
    label: "Crisis & Resilience",
    icon: LifeBuoy,
    iconClassName: "text-amber-600 dark:text-amber-400",
    keywords: [
      "resilient_democracy",
      "civil_protection",
      "health_security",
      "cyber_resilience",
      "recovery_transition",
      "climate_resilience",
    ],
  },
] as const;

const getTemplateGroup = (templateId: string, templateName: string): TemplateGroupId => {
  const normalized = `${templateId} ${templateName}`.toLowerCase();
  const matchedGroup = TEMPLATE_GROUP_CONFIG.find((group) =>
    group.keywords.some((keyword) => normalized.includes(keyword))
  );
  return matchedGroup?.id ?? "economic";
};

const COLLAPSED_GROUPS_STORAGE_KEY = "ixstats.atomicTemplates.collapsedGroups";
const DEFAULT_COLLAPSED_GROUPS = new Set<TemplateGroupId>(
  TEMPLATE_GROUP_CONFIG.map((group) => group.id)
);

/**
 * Select preset government templates
 */
export const TemplateSelector = React.memo<TemplateSelectorProps>(
  ({ templates, onSelect, disabled = false }) => {
    const [collapsedGroups, setCollapsedGroups] =
      useState<Set<TemplateGroupId>>(DEFAULT_COLLAPSED_GROUPS);
    const [hasHydratedCollapsedState, setHasHydratedCollapsedState] = useState(false);

    useEffect(() => {
      try {
        const stored = window.sessionStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
        if (!stored) {
          setCollapsedGroups(new Set(DEFAULT_COLLAPSED_GROUPS));
          setHasHydratedCollapsedState(true);
          return;
        }

        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
          setCollapsedGroups(new Set(DEFAULT_COLLAPSED_GROUPS));
          setHasHydratedCollapsedState(true);
          return;
        }

        const validGroupIds = new Set(TEMPLATE_GROUP_CONFIG.map((group) => group.id));
        const nextCollapsed = parsed.filter(
          (groupId): groupId is TemplateGroupId =>
            typeof groupId === "string" && validGroupIds.has(groupId as TemplateGroupId)
        );

        setCollapsedGroups(new Set(nextCollapsed));
      } catch {
        // Ignore malformed storage payloads and keep defaults.
        setCollapsedGroups(new Set(DEFAULT_COLLAPSED_GROUPS));
      } finally {
        setHasHydratedCollapsedState(true);
      }
    }, []);

    useEffect(() => {
      if (!hasHydratedCollapsedState) {
        return;
      }

      const serialized = JSON.stringify(Array.from(collapsedGroups));
      window.sessionStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, serialized);
    }, [collapsedGroups, hasHydratedCollapsedState]);

    const groupedTemplates = useMemo(() => {
      const buckets: Record<TemplateGroupId, [string, GovernmentTemplate][]> = {
        democratic: [],
        technocratic: [],
        security: [],
        social: [],
        economic: [],
        diplomatic: [],
        resilience: [],
      };

      Object.entries(templates).forEach(([id, template]) => {
        const groupId = getTemplateGroup(id, template.name);
        buckets[groupId].push([id, template]);
      });

      return TEMPLATE_GROUP_CONFIG.map((group) => ({
        ...group,
        templates: buckets[group.id],
      })).filter((group) => group.templates.length > 0);
    }, [templates]);

    if (groupedTemplates.length === 0) {
      return null;
    }

    const toggleGroup = (groupId: TemplateGroupId) => {
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupId)) {
          next.delete(groupId);
        } else {
          next.add(groupId);
        }
        return next;
      });
    };

    return (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <Select onValueChange={onSelect} disabled={disabled}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Load Template..." />
          </SelectTrigger>
          <SelectContent>
            {groupedTemplates.map((group, groupIndex) => (
              <React.Fragment key={group.id}>
                <SelectGroup>
                  <SelectLabel className="flex items-center justify-between gap-2 py-1">
                    <span className="flex items-center gap-2">
                      <group.icon className={`h-3.5 w-3.5 ${group.iconClassName}`} />
                      <span>{group.label}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {group.templates.length}
                      </Badge>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleGroup(group.id);
                        }}
                        className="rounded p-0.5 transition-colors hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
                        aria-label={`Toggle ${group.label}`}
                      >
                        {collapsedGroups.has(group.id) ? (
                          <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </span>
                  </SelectLabel>
                  {!collapsedGroups.has(group.id) &&
                    group.templates.map(([id, template]) => (
                      <SelectItem key={id} value={id}>
                        <div className="flex flex-col gap-1 py-1">
                          <div className="flex items-center gap-2">
                            <group.icon className={`h-3.5 w-3.5 ${group.iconClassName}`} />
                            <span className="font-medium">{template.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {template.components.length} components
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {template.description}
                          </p>
                        </div>
                      </SelectItem>
                    ))}
                </SelectGroup>
                {groupIndex < groupedTemplates.length - 1 && <SelectSeparator />}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
);

TemplateSelector.displayName = "TemplateSelector";
