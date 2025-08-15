"use client";

import React, { useMemo } from "react";
import { 
  Globe, BarChart3, Settings, Activity, TrendingUp, Crown, 
  Gauge, Eye, Target, Command
} from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { createUrl } from "~/lib/url-utils";

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
          { title: "Go to Countries", icon: <Globe className="h-4 w-4" />, action: () => window.location.href = createUrl("/countries/new") },
          { title: "View Analytics", icon: <BarChart3 className="h-4 w-4" />, action: () => window.location.href = createUrl("/analytics") },
          { title: "Open Settings", icon: <Settings className="h-4 w-4" />, action: () => window.location.href = createUrl("/settings") },
        ]
      },
      {
        group: "Quick Actions",
        items: [
          { title: "Refresh Data", icon: <Activity className="h-4 w-4" />, action: () => window.location.reload() },
          { title: "Export Statistics", icon: <TrendingUp className="h-4 w-4" />, action: () => console.log("Export statistics") },
        ]
      }
    ];

    // Only show dashboard sections if user has configured their country profile
    if (userProfile?.countryId) {
      baseItems.splice(1, 0, {
        group: "Dashboard Sections",
        items: [
          { title: "Go to MyCountry", icon: <Crown className="h-4 w-4" />, action: () => window.location.href = createUrl("/mycountry") },
          { title: "Open ECI Suite", icon: <Gauge className="h-4 w-4" />, action: () => window.location.href = createUrl("/eci") },
          { title: "Access SDI Intelligence", icon: <Eye className="h-4 w-4" />, action: () => window.location.href = createUrl("/sdi") },
        ]
      });
    } else {
      // Show setup-related commands for users without country profiles
      baseItems.splice(1, 0, {
        group: "Setup Required",
        items: [
          { title: "Complete Setup", icon: <Target className="h-4 w-4" />, action: () => window.location.href = createUrl("/setup") },
          { title: "Configure Profile", icon: <Settings className="h-4 w-4" />, action: () => window.location.href = createUrl("/profile") },
        ]
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