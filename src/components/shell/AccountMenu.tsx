"use client";

/**
 * The signed-in player's account in the shell: avatar (country flag once a nation is linked),
 * name and country; your country (MyCountry), your passport and wiki profiles, the nation
 * switcher, a link to the nation's public page (the country row above goes to MyCountry), IxnayID
 * connections, the external account manager and sign out. Signed out, it is the sign-in button.
 *
 * `layout="sidebar"` is a popover opened from the AppSidebar's footer row; `layout="sheet"` is the
 * same panel inline in the TabBar's More sheet.
 */

import * as React from "react";
import Link from "next/link";
import {
  Crown,
  LogOut,
  Link as LinkIcon,
  OpenBook,
  Settings,
  User,
  UserCircle,
  WarningCircle,
} from "iconoir-react";

import { useAuth, useUser, SignInButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useCountryFlag } from "~/hooks/useCountryFlags";
import { useUserCountry } from "~/hooks/useUserCountry";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { cn } from "~/lib/utils/cn";
import { createAbsoluteUrl } from "~/lib/utils/url-utils";
import { getNationUrl } from "~/lib/utils/slug-utils";
import { focusRing, Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { NationSwitcher } from "~/components/navigation/NationSwitcher";
import { CollapsedTooltip, rowBase } from "./AppSidebar";

interface AccountMenuProps {
  layout: "sidebar" | "sheet";
  /** The sidebar is collapsed to icons (`null` before hydration). */
  collapsed?: boolean | null;
}

const itemClass = cn(
  "text-body text-label hover:bg-fill-4 rounded-control flex min-h-9 w-full items-center gap-3 px-2.5 pointer-coarse:min-h-11",
  focusRing
);

function useAccount() {
  const { user } = useUser();
  const { data: profile } = api.users.getProfile.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const country = profile?.country ?? null;
  const { flag } = useCountryFlag(country?.name ?? "");
  const name = user?.firstName || user?.username || "Account";
  return {
    user,
    name,
    countryName: country?.name ?? null,
    flagUrl: country ? (flag?.flagUrl ?? null) : null,
    needsSetup: Boolean(user) && profile !== undefined && !profile?.countryId,
  };
}

function Avatar({
  imageUrl,
  name,
  className,
}: {
  imageUrl?: string | null;
  name: string;
  className: string;
}) {
  if (imageUrl) {
    // Clerk avatar or flag URL; next/image would need its host allow-listed.
    return (
      <img src={imageUrl} alt="" className={cn("shrink-0 rounded-full object-cover", className)} />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "bg-fill-3 text-label-secondary flex shrink-0 items-center justify-center rounded-full",
        className
      )}
    >
      {name[0]?.toUpperCase() ?? <User className="size-4" />}
    </span>
  );
}

/** Your country, passport and wiki profile: what the per-app player and wiki widgets offered. */
function IdentityLinks({ onClose }: { onClose?: () => void }) {
  const { user } = useUser();
  const { country } = useUserCountry();
  // Only the open panel mounts this, so the wiki lookup does not run on every page.
  const { data: wikiProfile } = api.wikios.getAuthorProfile.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
  const done = () => onClose?.();
  // The passport resolver never matches Clerk usernames, but it treats the handle "me" as the
  // signed-in player, so the wiki link falls back to "me" rather than the account username.
  const wikiName = wikiProfile?.displayName ?? "me";

  return (
    <ul className="flex flex-col gap-0.5 pb-1">
      {country && (
        <li>
          <Link href="/mycountry" onClick={done} className={itemClass}>
            <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
              <UnifiedCountryFlag
                countryName={country.name}
                flagUrl={normalizeFlagUrl(country.flag)}
                size="xs"
                showTooltip={false}
              />
            </span>
            <span className="min-w-0 flex-1 truncate">{country.name}</span>
          </Link>
        </li>
      )}
      <li>
        <Link href="/@me" onClick={done} className={itemClass}>
          <UserCircle aria-hidden className="size-4 shrink-0" />
          Your profile
        </Link>
      </li>
      <li>
        <Link href={getWikiProfilePath(wikiName)} onClick={done} className={itemClass}>
          <OpenBook aria-hidden className="size-4 shrink-0" />
          Wiki profile
        </Link>
      </li>
    </ul>
  );
}

function AccountPanel({ onClose }: { onClose?: () => void }) {
  const { signOut } = useAuth();
  const { user, name, countryName, flagUrl, needsSetup } = useAccount();
  const done = () => onClose?.();

  return (
    <div data-slot="account-panel" className="flex flex-col gap-1">
      <div className="flex items-center gap-3 px-2.5 pt-1 pb-2">
        <Avatar
          imageUrl={flagUrl ?? user?.imageUrl}
          name={name}
          className="text-headline size-10"
        />
        <div className="min-w-0">
          <p className="text-headline text-label truncate">{name}</p>
          <p className="text-footnote text-label-secondary truncate">
            {countryName ?? "No nation linked"}
          </p>
        </div>
      </div>

      <IdentityLinks onClose={onClose} />

      <NationSwitcher onSwitched={done} className="border-separator -mx-1 border-t pt-1 pb-1" />

      <ul className="border-separator flex flex-col gap-0.5 border-t pt-1">
        {countryName && (
          <li>
            <Link href={getNationUrl(countryName)} onClick={done} className={itemClass}>
              <Crown aria-hidden className="size-4 shrink-0" />
              Public country page
            </Link>
          </li>
        )}
        {needsSetup && (
          <li>
            <Link href="/setup" onClick={done} className={itemClass}>
              <WarningCircle aria-hidden className="size-4 shrink-0" />
              Finish setup
            </Link>
          </li>
        )}
        <li>
          <Link href="/settings?tab=account#ixnayid-card" onClick={done} className={itemClass}>
            <LinkIcon aria-hidden className="size-4 shrink-0" />
            IxnayID connections
          </Link>
        </li>
        <li>
          <a
            href="https://accounts.ixwiki.com/user"
            target="_blank"
            rel="noopener noreferrer"
            className={itemClass}
          >
            <Settings aria-hidden className="size-4 shrink-0" />
            Manage account
          </a>
        </li>
        <li>
          <button
            type="button"
            onClick={() => {
              void signOut().finally(() => {
                window.location.href = createAbsoluteUrl("/");
              });
            }}
            className={cn(itemClass, "cursor-pointer")}
          >
            <LogOut aria-hidden className="size-4 shrink-0" />
            Sign out
          </button>
        </li>
      </ul>

      {/* The sidebar's footer links hide while it is collapsed and the phone tab bar has none. */}
      <p className="border-separator text-caption text-label-secondary flex items-center gap-3 border-t px-2.5 pt-2 pb-1">
        <Link href="/privacy" onClick={done} className="hover:text-label hover:underline">
          Privacy
        </Link>
        <Link href="/terms" onClick={done} className="hover:text-label hover:underline">
          Terms
        </Link>
      </p>
    </div>
  );
}

export function AccountMenu({ layout, collapsed }: AccountMenuProps) {
  const [open, setOpen] = React.useState(false);
  const { user, name, flagUrl } = useAccount();

  if (!user) {
    return (
      <SignInButton mode="modal">
        <Button
          variant="secondary"
          size="sm"
          className={cn(layout === "sheet" ? "w-full" : "sidebar-collapsed:w-auto w-full")}
        >
          Sign in
        </Button>
      </SignInButton>
    );
  }

  if (layout === "sheet") return <AccountPanel />;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <CollapsedTooltip collapsed={collapsed ?? false} label={name}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Account: ${name}`}
            aria-haspopup="dialog"
            className={cn(rowBase, focusRing, "text-label hover:bg-fill-4 cursor-pointer")}
          >
            <Avatar
              imageUrl={flagUrl ?? user.imageUrl}
              name={name}
              className="text-caption size-6"
            />
            <span className="sidebar-collapsed:sr-only min-w-0 flex-1 truncate text-left">
              {name}
            </span>
          </button>
        </PopoverTrigger>
      </CollapsedTooltip>
      <PopoverContent side="right" align="end" className="w-64 p-2">
        <AccountPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
