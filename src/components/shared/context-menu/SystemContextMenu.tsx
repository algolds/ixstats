"use client";

import { createContext, Fragment, use, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Globe,
  Link as LinkIcon,
  MediaImage,
  OpenInWindow,
  OpenNewWindow,
  Refresh,
  User,
} from "iconoir-react";
import { useOpenCountryActions } from "~/components/shared/country-actions/CountryActionsProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useNotify } from "~/hooks/useNotify";
import {
  CONTEXT_AREA_ATTR,
  countryProfilePath,
  resolveContextTarget,
  type ContextTarget,
} from "~/lib/navigation/context-target";

/** Where the menu opened, in viewport pixels (a drawn surface reads what is under it). */
export interface ContextPoint {
  x: number;
  y: number;
}

/** An area's own items for the system menu: `DropdownMenuItem`s, or nothing for this target. */
export type ContextAreaItems = (target: ContextTarget, point: ContextPoint) => React.ReactNode;

type AreaRegistry = Map<string, ContextAreaItems>;

const AreaRegistryContext = createContext<AreaRegistry | null>(null);

/**
 * Adds an area's own items to the top of the system context menu. Spread the returned attribute on the
 * area's root element; a right-click anywhere inside it then shows these items above the defaults.
 * For a thing with an identity (a post, a message) use `ContextMenu` from `~/components/ui/context-menu`:
 * it takes the event first and replaces the system menu there.
 */
export function useContextArea(items: ContextAreaItems): { [CONTEXT_AREA_ATTR]: string } {
  const id = useId();
  const registry = use(AreaRegistryContext);
  useEffect(() => {
    registry?.set(id, items);
    return () => {
      registry?.delete(id);
    };
  });
  return { [CONTEXT_AREA_ATTR]: id };
}

interface OpenMenu {
  target: ContextTarget;
  x: number;
  y: number;
  /** What had focus when the menu opened; it gets focus back on close. */
  focused: Element | null;
}

/**
 * The app's one context menu: a right-click, a long-press or the Menu key opens a Facet menu about what was
 * hit (a link, a nation, an image, selected text, else the page). The browser's own menu stays on
 * Shift+right-click, in text fields, on maps and canvases, and wherever a feature's `ContextMenu` took the
 * event (see `resolveContextTarget`).
 */
export function SystemContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [registry] = useState<AreaRegistry>(() => new Map());
  const [menu, setMenu] = useState<OpenMenu | null>(null);

  useEffect(() => {
    // On window, in the bubble phase: React (rooted at the document) has by then run every feature's
    // own handler, so an event one of them took arrives with its default prevented.
    const onContextMenu = (event: MouseEvent) => {
      const target = resolveContextTarget(
        {
          target: event.target,
          button: event.button,
          shiftKey: event.shiftKey,
          defaultPrevented: event.defaultPrevented,
          pointerType:
            typeof PointerEvent !== "undefined" && event instanceof PointerEvent
              ? event.pointerType
              : undefined,
        },
        window.getSelection()
      );
      if (!target) return;
      event.preventDefault();
      setMenu({ target, x: event.clientX, y: event.clientY, focused: document.activeElement });
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  return (
    <AreaRegistryContext value={registry}>
      {children}
      {menu && <SystemMenu menu={menu} registry={registry} onClose={() => setMenu(null)} />}
    </AreaRegistryContext>
  );
}

function SystemMenu({
  menu: { target, x, y, focused },
  registry,
  onClose,
}: {
  menu: OpenMenu;
  registry: AreaRegistry;
  onClose: () => void;
}) {
  const router = useRouter();
  const notify = useNotify();
  const openCountry = useOpenCountryActions();

  const copy = (text: string, done: string) => {
    navigator.clipboard.writeText(text).then(
      () => notify.success(done),
      () => notify.error("Could not copy", "The browser blocked clipboard access.")
    );
  };
  const openLink = () => {
    if (target.anchor?.isConnected) target.anchor.click();
    else if (target.link) window.location.assign(target.link);
  };
  const newTab = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const { link, country, image, selection } = target;
  const groups: { key: string; items: React.ReactNode }[] = target.areas.flatMap((id) => {
    const items = registry.get(id)?.(target, { x, y });
    return items ? [{ key: id, items }] : [];
  });
  if (selection) {
    groups.push({
      key: "selection",
      items: (
        <DropdownMenuItem onSelect={() => copy(selection, "Copied")}>
          <Copy aria-hidden />
          Copy
        </DropdownMenuItem>
      ),
    });
  }
  if (link) {
    groups.push({
      key: "link",
      items: (
        <>
          {country ? (
            <>
              <DropdownMenuItem onSelect={() => openCountry(country)}>
                <Globe aria-hidden />
                Open nation
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push(countryProfilePath(country))}>
                <User aria-hidden />
                Open profile
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onSelect={openLink}>
              <OpenInWindow aria-hidden />
              Open
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => newTab(link)}>
            <OpenNewWindow aria-hidden />
            Open in new tab
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(link, "Link copied")}>
            <LinkIcon aria-hidden />
            Copy link
          </DropdownMenuItem>
        </>
      ),
    });
  }
  if (image) {
    groups.push({
      key: "image",
      items: (
        <>
          <DropdownMenuItem onSelect={() => newTab(image)}>
            <MediaImage aria-hidden />
            Open image
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(image, "Image address copied")}>
            <Copy aria-hidden />
            Copy image address
          </DropdownMenuItem>
        </>
      ),
    });
  }
  if (target.page) {
    groups.push({
      key: "page",
      items: (
        <>
          <DropdownMenuItem onSelect={() => window.history.back()}>
            <ArrowLeft aria-hidden />
            Back
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => window.location.reload()}>
            <Refresh aria-hidden />
            Reload
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(window.location.href, "Page link copied")}>
            <LinkIcon aria-hidden />
            Copy page link
          </DropdownMenuItem>
        </>
      ),
    });
  }

  // A viewport point, so the menu hangs off a fixed 1px anchor there; Radix supplies the keyboard,
  // typeahead, collision handling and outside-click dismissal. Not modal: a right-click elsewhere
  // closes this menu and opens the next one on its real target.
  return (
    <DropdownMenu key={`${x},${y}`} open modal={false} onOpenChange={(open) => !open && onClose()}>
      {createPortal(
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            className="pointer-events-none fixed size-px"
            style={{ left: x, top: y }}
          />
        </DropdownMenuTrigger>,
        document.body
      )}
      <DropdownMenuContent
        align="start"
        sideOffset={0}
        aria-label={country?.name ? `${country.name} actions` : "Actions"}
        aria-labelledby={undefined}
        className="min-w-52"
        // Radix would return focus to the trigger, a 1px anchor: hand it back to what had it.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (focused instanceof HTMLElement && focused.isConnected) focused.focus();
        }}
      >
        {groups.map((group, i) => (
          <Fragment key={group.key}>
            {i > 0 && <DropdownMenuSeparator />}
            {group.items}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
