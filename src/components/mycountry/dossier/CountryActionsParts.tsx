"use client";

import { City, Community, EditPencil, Map, Page, ScaleFrameEnlarge, ShareIos } from "iconoir-react";
import { editorHref, MYCOUNTRY_MAP_EDITOR_PATH } from "~/lib/mycountry/routes";
import { useNotify } from "~/hooks/useNotify";
import { cn, createUrl } from "~/lib/utils";
import { focusRing, hitSlop } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { type IconType, QuickAction, type Tone } from "./CountryActionsHeader";

/**
 * The four places a ruler runs their nation from. The editors are not here: they sit behind the poster's Edit
 * button, so the grid is one row in the country actions sheet and in Halo alike.
 */
export const MANAGE_LINKS: ReadonlyArray<
  readonly [icon: IconType, label: string, path: string, tone: Tone]
> = [
  [City, "Dashboard", "/mycountry", "yellow"],
  [Page, "Executive", "/mycountry/executive", "orange"],
  [Community, "Diplomacy", "/mycountry/diplomacy", "green"],
  [ScaleFrameEnlarge, "Politics", "/mycountry/politics", "cyan"],
];

/** The editors behind the poster's Edit button. */
const EDIT_LINKS: ReadonlyArray<
  readonly [icon: IconType, label: string, hint: string, path: string]
> = [
  [EditPencil, "Country editor", "Name, flag, symbols and government", editorHref("identity")],
  [Map, "Map editor", "Borders and provinces", MYCOUNTRY_MAP_EDITOR_PATH],
];

const EDIT_PILL =
  "bg-fill-3 text-label-secondary hover:bg-fill-2 hover:text-label text-footnote duration-fast relative inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-3 font-medium transition-colors";

const SHARE_PILL =
  "bg-fill-3 text-label-secondary hover:bg-fill-2 hover:text-label duration-fast ease-out-facet relative inline-flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors [&_svg]:pointer-events-none [&_svg]:shrink-0 [:where(&)_svg]:size-4";

/** Manage: one row of round tiles, each opening a MyCountry section. */
export function ManageGrid({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section aria-labelledby="country-manage" className="space-y-2">
      <h3 id="country-manage" className="text-subhead text-label-secondary px-1">
        Manage
      </h3>
      <div className="grid grid-cols-4 gap-1">
        {MANAGE_LINKS.map(([icon, label, path, tone]) => (
          <QuickAction
            key={path}
            icon={icon}
            label={label}
            tone={tone}
            onClick={() => onNavigate(path)}
          />
        ))}
      </div>
    </section>
  );
}

/** Edit: the country editor and the map editor in one menu that opens from the button. */
export function EditNationMenu({
  onNavigate,
  className,
}: {
  onNavigate: (path: string) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The same pill as the sheet's Close and Share, so the poster's corner reads as one set of controls. */}
        <button type="button" className={cn(EDIT_PILL, focusRing, hitSlop, className)}>
          <EditPencil aria-hidden className="size-3.5" />
          Edit
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {EDIT_LINKS.map(([Icon, label, hint, path]) => (
          <DropdownMenuItem key={path} onSelect={() => onNavigate(path)} className="items-start">
            <Icon aria-hidden className="mt-0.5 size-4" />
            <span className="flex flex-col">
              <span className="text-body text-label">{label}</span>
              <span className="text-footnote text-label-secondary">{hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A nation's public profile link: the system share sheet where there is one, else the link on the clipboard. */
export function ShareCountryButton({
  name,
  slugOrId,
  className,
}: {
  name: string;
  slugOrId: string;
  className?: string;
}) {
  const notify = useNotify();
  const share = () => {
    const url = `${window.location.origin}${createUrl(`/countries/${slugOrId}`)}`;
    if (navigator.share) {
      void navigator.share({ title: name, url }).catch(() => undefined);
      return;
    }
    void navigator.clipboard.writeText(url).then(() => notify.success("Link copied"));
  };
  return (
    <button
      type="button"
      onClick={share}
      aria-label={`Share ${name}`}
      title="Share"
      className={cn(SHARE_PILL, focusRing, hitSlop, className)}
    >
      <ShareIos />
    </button>
  );
}
