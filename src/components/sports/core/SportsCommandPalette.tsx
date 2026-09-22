"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Shield,
  Play,
  Calendar,
  Activity,
  Search,
  Book,
  User,
} from "iconoir-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "~/components/ui/command";
import { withBasePath } from "~/lib/base-path";
import { useSportsFocus } from "./SportsFocusProvider";
import { soundEffects } from "~/lib/sound/cuelume";

export interface SportsCommandPaletteProps {
  onNavigateSection?: (section: string) => void;
  onSimulateNext?: () => void;
  teams?: Array<{ id: string; name: string; logo?: string | null }>;
}

export function SportsCommandPalette({
  onNavigateSection,
  onSimulateNext,
  teams = [],
}: SportsCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { focusOrganization } = useSportsFocus();

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        soundEffects.press();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    soundEffects.press();
    setOpen(false);
    command();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Sports Command Palette"
      description="Quick actions, navigation, and club search"
      className="max-w-xl border-border/40 bg-card/95 backdrop-blur-2xl rounded-3xl"
    >
      <CommandInput placeholder="Type a command or search a club (⌘K)..." />
      <CommandList className="max-h-80 overflow-y-auto p-2">
        <CommandEmpty>No matching commands or clubs found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          {onSimulateNext && (
            <CommandItem
              onSelect={() => runCommand(onSimulateNext)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer font-bold text-xs hover:bg-muted/40"
            >
              <Play className="h-4 w-4 text-primary fill-current" />
              <span>Simulate Next Match</span>
            </CommandItem>
          )}

          {onNavigateSection && (
            <>
              <CommandItem
                onSelect={() => runCommand(() => onNavigateSection("standings"))}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer font-bold text-xs hover:bg-muted/40"
              >
                <Trophy className="h-4 w-4 text-amber-400" />
                <span>View Standings Matrix</span>
              </CommandItem>

              <CommandItem
                onSelect={() => runCommand(() => onNavigateSection("schedule"))}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer font-bold text-xs hover:bg-muted/40"
              >
                <Calendar className="h-4 w-4 text-cyan-400" />
                <span>View Schedule & Fixtures</span>
              </CommandItem>

              <CommandItem
                onSelect={() => runCommand(() => onNavigateSection("history"))}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer font-bold text-xs hover:bg-muted/40"
              >
                <Book className="h-4 w-4 text-indigo-400" />
                <span>View Competition Almanac</span>
              </CommandItem>
            </>
          )}
        </CommandGroup>

        <CommandSeparator className="my-1" />

        {/* Clubs Directory */}
        {teams.length > 0 && (
          <CommandGroup heading="Clubs">
            {teams.map((team) => (
              <CommandItem
                key={team.id}
                onSelect={() => runCommand(() => focusOrganization(team.id))}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer font-bold text-xs hover:bg-muted/40"
              >
                <Shield className="h-4 w-4 text-cyan-400" />
                <span>{team.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator className="my-1" />

        {/* Global Navigation */}
        <CommandGroup heading="Portals">
          <CommandItem
            onSelect={() => runCommand(() => router.push(withBasePath("/myleague")))}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer font-bold text-xs hover:bg-muted/40"
          >
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span>Browse Competitions (MyLeague)</span>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => router.push(withBasePath("/myclub")))}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 cursor-pointer font-bold text-xs hover:bg-muted/40"
          >
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span>Franchise Headquarters (MyClub)</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export default SportsCommandPalette;
