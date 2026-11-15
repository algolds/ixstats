"use client";

import Link from "next/link";
import { COUNTRY_ATTRS } from "~/lib/navigation/context-target";
import { isPlainClick } from "~/lib/navigation/plain-click";
import { useOpenCountryActions, type CountryTarget } from "./CountryActionsProvider";

type LinkProps = React.ComponentProps<typeof Link>;

/**
 * For a link that is not a `CountryLink` (a list row, a card): its click handler opens the nation's actions
 * sheet on a plain click and leaves modified and middle clicks to the link.
 */
export function useCountryClick() {
  const openActions = useOpenCountryActions();
  return (country: CountryTarget) => (e: React.MouseEvent<HTMLElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    openActions(country);
  };
}

interface CountryLinkProps extends Omit<LinkProps, "href"> {
  country: CountryTarget;
  /** Defaults to the nation's profile; a modified or middle click still goes there. */
  href?: LinkProps["href"];
}

/**
 * A link to a nation. A plain click opens its actions sheet; Cmd/Ctrl/middle click and "open in new tab"
 * reach the profile, because it stays a real link.
 */
export function CountryLink({ country, href, onClick, ...props }: CountryLinkProps) {
  const countryClick = useCountryClick();
  return (
    <Link
      href={href ?? `/countries/${encodeURIComponent(country.slug ?? country.id ?? "")}`}
      onClick={(e) => {
        onClick?.(e);
        countryClick(country)(e);
      }}
      // Tells the system context menu which nation this link is.
      {...{
        [COUNTRY_ATTRS.id]: country.id,
        [COUNTRY_ATTRS.slug]: country.slug ?? undefined,
        [COUNTRY_ATTRS.name]: country.name,
      }}
      {...props}
    />
  );
}
