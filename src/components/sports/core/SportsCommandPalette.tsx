"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Shield, Play, Calendar, Activity, Search, Book, User } from "iconoir-react";
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
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Sports command palette"
      description="Quick actions, navigation, and club search"
      className="border-separator bg-surface rounded-sheet max-w-xl"
    >
      <CommandInput placeholder="Type a command or search a club (⌘K)..." />
      <CommandList className="max-h-80 overflow-y-auto p-2">
        <CommandEmpty>No matching commands or clubs found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick actions">
          {onSimulateNext && (
            <CommandItem
              onSelect={() => runCommand(onSimulateNext)}
              className="rounded-row text-footnote hover:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 font-semibold"
            >
              <Play className="text-tint h-4 w-4 fill-current" />
              <span>Simulate next match</span>
            </CommandItem>
          )}

          {onNavigateSection && (
            <>
              <CommandItem
                onSelect={() => runCommand(() => onNavigateSection("standings"))}
                className="rounded-row text-footnote hover:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 font-semibold"
              >
                <Trophy className="text-yellow h-4 w-4" />
                <span>View standings matrix</span>
              </CommandItem>

              <CommandItem
                onSelect={() => runCommand(() => onNavigateSection("schedule"))}
                className="rounded-row text-footnote hover:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 font-semibold"
              >
                <Calendar className="text-teal h-4 w-4" />
                <span>View schedule & fixtures</span>
              </CommandItem>

              <CommandItem
                onSelect={() => runCommand(() => onNavigateSection("history"))}
                className="rounded-row text-footnote hover:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 font-semibold"
              >
                <Book className="text-indigo h-4 w-4" />
                <span>View competition almanac</span>
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
                className="rounded-row text-footnote hover:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 font-semibold"
              >
                <Shield className="text-teal h-4 w-4" />
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
            className="rounded-row text-footnote hover:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 font-semibold"
          >
            <Trophy className="text-label-secondary h-4 w-4" />
            <span>Browse Competitions (MyLeague)</span>
          </CommandItem>

          <CommandItem
            onSelect={() => runCommand(() => router.push(withBasePath("/myclub")))}
            className="rounded-row text-footnote hover:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 font-semibold"
          >
            <Shield className="text-label-secondary h-4 w-4" />
            <span>Franchise Headquarters (MyClub)</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export default SportsCommandPalette;
