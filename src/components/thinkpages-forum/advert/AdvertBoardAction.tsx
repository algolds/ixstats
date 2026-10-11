"use client";

import Link from "next/link";
import { EditPencil } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useUser } from "~/context/auth-context";
import { newAdvertHref, threadHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";

interface AdvertChoice {
  slug: string;
  name: string;
  advertThreadId: string | null;
  hiddenByModerator: boolean;
}

const HIDDEN_LINE = "Your advert was hidden by a moderator";

/** Where a realm's entry goes: its advert when it has one, else the form that creates it. */
const hrefOf = (r: AdvertChoice) =>
  r.advertThreadId ? threadHref(r.advertThreadId) : newAdvertHref(r.slug);

/** "Edit your advert" once every realm that can be acted on has one. */
function labelOf(open: AdvertChoice[]): string {
  return open.every((r) => r.advertThreadId !== null) ? "Edit your advert" : "Advertise your realm";
}

function HiddenLine({ children }: { children: string }) {
  return <p className="text-callout text-label-secondary">{children}</p>;
}

function AdvertMenu({ realms, label }: { realms: AdvertChoice[]; label: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="pointer-coarse:min-h-11">
          <EditPencil aria-hidden />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {realms.map((r) =>
          r.hiddenByModerator ? (
            <DropdownMenuItem key={r.slug} disabled className="pointer-coarse:min-h-11">
              {`The ${r.name} advert was hidden by a moderator`}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={r.slug} asChild className="pointer-coarse:min-h-11">
              <Link href={hrefOf(r)}>
                {r.advertThreadId ? `Edit the ${r.name} advert` : `Advertise ${r.name}`}
              </Link>
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Find a Realm's header action for a viewer who founds or serves a realm with the Appearance power (the server offers
 * only realms where creating the advert would succeed): "Advertise your realm", or "Edit your advert" once every
 * realm has one. One link for one realm, a menu for several; a realm whose advert a moderator hid offers nothing to
 * open or create, only that line. Shows nothing to anyone else.
 */
export function AdvertBoardAction() {
  const { isSignedIn } = useUser();
  const { data } = api.thinkpagesForum.myAdvertRealms.useQuery(undefined, {
    enabled: !!isSignedIn,
  });
  const realms = isSignedIn ? (data?.realms ?? []) : [];
  const open = realms.filter((r) => !r.hiddenByModerator);
  if (realms.length === 0) return null;
  if (open.length === 0) return <HiddenLine>{HIDDEN_LINE}</HiddenLine>;
  const label = labelOf(open);
  if (realms.length > 1) return <AdvertMenu realms={realms} label={label} />;
  return (
    <Button asChild size="sm" className="pointer-coarse:min-h-11">
      <Link href={hrefOf(open[0]!)}>
        <EditPencil aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
