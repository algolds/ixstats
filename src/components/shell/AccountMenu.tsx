"use client";

/**
 * The signed-in player's account in the shell: Clerk portrait, display name and linked nation;
 * direct links to MyCountry (`/mycountry`), Passport (`/@me`) and Stash (`/stashes`), the nation
 * switcher, the external account manager and sign out. Halo's `AccountView` owns the rich
 * two-sided MyCountry | Passport poster and quick Settings owns appearance toggles.
 *
 * `layout="sidebar"` is a popover opened from the AppSidebar's footer row; `layout="sheet"` is the
 * same panel inline in the TabBar's More sheet.
 */

import * as React from "react";
import Link from "next/link";
import { Bookmark, LogOut, Settings, User, UserCircle, WarningCircle } from "iconoir-react";

import { useAuth, useUser, SignInButton } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { cn } from "~/lib/utils/cn";
import { createAbsoluteUrl } from "~/lib/utils/url-utils";
import { focusRing, Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { NationSwitcher } from "~/components/navigation/NationSwitcher";
import { CollapsedTooltip, rowBase } from "./AppSidebar";
import { assetUrl } from "~/lib/base-path";

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
  const name = user?.firstName || user?.username || "Account";
  return {
    user,
    name,
    countryName: country?.name ?? null,
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
    // Clerk portrait URL; next/image would need its host allow-listed.
    return (
      <img
        src={assetUrl(imageUrl) ?? undefined}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
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

/** Direct identity destinations: MyCountry, Passport and Stash. */
function IdentityLinks({ onClose }: { onClose?: () => void }) {
  const { country } = useUserCountry();
  const done = () => onClose?.();

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
            <span className="min-w-0 flex-1 truncate">MyCountry</span>
          </Link>
        </li>
      )}
      <li>
        <Link href="/@me" onClick={done} className={itemClass}>
          <UserCircle aria-hidden className="size-4 shrink-0" />
          Passport
        </Link>
      </li>
      <li>
        {/* The one Stash: saved pages, images and threads from every app. */}
        <Link href="/stashes" onClick={done} className={itemClass}>
          <Bookmark aria-hidden className="size-4 shrink-0" />
          Stash
        </Link>
      </li>
    </ul>
  );
}

function AccountPanel({
  onClose,
  showLegalLinks = false,
}: {
  onClose?: () => void;
  showLegalLinks?: boolean;
}) {
  const { signOut } = useAuth();
  const { user, name, countryName, needsSetup } = useAccount();
  const done = () => onClose?.();

  return (
    <div data-slot="account-panel" className="flex flex-col gap-1">
      <div className="flex items-center gap-3 px-2.5 pt-1 pb-2">
        <Avatar imageUrl={user?.imageUrl} name={name} className="text-headline size-10" />
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
        {needsSetup && (
          <li>
            <Link href="/setup" onClick={done} className={itemClass}>
              <WarningCircle aria-hidden className="size-4 shrink-0" />
              Finish setup
            </Link>
          </li>
        )}
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

      {/* Shown when SidebarFooterLinks is hidden (mobile More sheet or collapsed desktop rail). */}
      {showLegalLinks && (
        <p className="border-separator text-caption text-label-secondary flex items-center gap-3 border-t px-2.5 pt-2 pb-1">
          <Link href="/privacy" onClick={done} className="hover:text-label hover:underline">
            Privacy
          </Link>
          <Link href="/terms" onClick={done} className="hover:text-label hover:underline">
            Terms
          </Link>
        </p>
      )}
    </div>
  );
}

export function AccountMenu({ layout, collapsed }: AccountMenuProps) {
  const [open, setOpen] = React.useState(false);
  const { user, name } = useAccount();

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

  if (layout === "sheet") return <AccountPanel showLegalLinks />;

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
            <Avatar imageUrl={user.imageUrl} name={name} className="text-caption size-6" />
            <span className="sidebar-collapsed:sr-only min-w-0 flex-1 truncate text-left">
              {name}
            </span>
          </button>
        </PopoverTrigger>
      </CollapsedTooltip>
      <PopoverContent side="right" align="end" className="w-64 p-2">
        <AccountPanel onClose={() => setOpen(false)} showLegalLinks={Boolean(collapsed)} />
      </PopoverContent>
    </Popover>
  );
}
