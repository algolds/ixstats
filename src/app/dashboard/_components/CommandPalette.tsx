"use client";

import React, { useMemo } from "react";
import {
  Globe,
  BarChart3,
  Settings,
  Activity,
  TrendingUp,
  Crown,
  Gauge,
  Eye,
  Target,
  Command,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { createAbsoluteUrl } from "~/lib/url-utils";

interface UserProfile {
  countryId: string | null;
}

interface CommandPaletteProps {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  userProfile?: UserProfile;
}

export function CommandPalette({ commandOpen, setCommandOpen, userProfile }: CommandPaletteProps) {
  // Dynamic command palette items based on user profile and available features
  const commandItems = useMemo(() => {
    const baseItems = [
      {
        group: "Navigation",
        items: [
          {
            title: "Go to Countries",
            icon: <Globe className="h-4 w-4" />,
            action: () => (window.location.href = createAbsoluteUrl("/countries/new")),
          },
          {
            title: "View Analytics",
            icon: <BarChart3 className="h-4 w-4" />,
            action: () => (window.location.href = createAbsoluteUrl("/analytics")),
          },
          {
            title: "Open Settings",
            icon: <Settings className="h-4 w-4" />,
            action: () => (window.location.href = createAbsoluteUrl("/settings")),
          },
        ],
      },
      {
        group: "Quick Actions",
        items: [
          {
            title: "Refresh Data",
            icon: <Activity className="h-4 w-4" />,
            action: () => window.location.reload(),
          },
          {
            title: "Export Statistics",
            icon: <TrendingUp className="h-4 w-4" />,
            action: () => console.log("Export statistics"),
          },
        ],
      },
    ];

    // Only show dashboard sections if user has configured their country profile
    if (userProfile?.countryId) {
      baseItems.splice(1, 0, {
        group: "Dashboard Sections",
        items: [
          {
            title: "Go to MyCountry",
            icon: <Crown className="h-4 w-4" />,
            action: () => (window.location.href = createAbsoluteUrl("/mycountry")),
          },
          {
            title: "Intelligence Operations",
            icon: <Eye className="h-4 w-4" />,
            action: () => (window.location.href = createAbsoluteUrl("/mycountry/intelligence")),
          },
        ],
      });
    } else {
      // Show setup-related commands for users without country profiles
      baseItems.splice(1, 0, {
        group: "Setup Required",
        items: [
          {
            title: "Complete Setup",
            icon: <Target className="h-4 w-4" />,
            action: () => (window.location.href = createAbsoluteUrl("/setup")),
          },
          {
            title: "Configure Profile",
            icon: <Settings className="h-4 w-4" />,
            action: () => (window.location.href = createAbsoluteUrl("/profile")),
          },
        ],
      });
    }

    return baseItems;
  }, [userProfile?.countryId]);

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search commands and navigation..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {commandItems.map((group, groupIndex) => (
          <CommandGroup key={groupIndex} heading={group.group}>
            {group.items.map((item, itemIndex) => (
              <CommandItem
                key={itemIndex}
                onSelect={() => {
                  item.action();
                  setCommandOpen(false);
                }}
              >
                {item.icon}
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
