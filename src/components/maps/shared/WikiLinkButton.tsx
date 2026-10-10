import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { OpenNewWindow as ExternalLink } from "iconoir-react";
import { toRouterPath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";

/**
 * In-app wiki pages (WikiOS paths) open via `Link`; anything else opens in a new tab. `Link` adds the base path
 * itself, so a path that arrives with it (`/projects/ixstates/wiki/X`) is handed over without it (`toRouterPath`).
 */
const isInternalWikiUrl = (url: string) => url.startsWith("/") || url.includes("/wiki/");

/** Plain wiki link: `Link` for in-app pages, a new-tab anchor otherwise. */
export function WikiAnchor({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return isInternalWikiUrl(href) ? (
    <Link href={toRouterPath(href)} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

/** Display name of the wiki a URL points at (in-app pages are IxWiki). */
export const wikiSiteName = (url: string) =>
  isInternalWikiUrl(url) || url.includes("ixwiki") ? "IxWiki" : "IIWiki";

/** Wiki article link button; `externalIcon` marks new-tab links with an external-link glyph. */
export function WikiLinkButton({
  url,
  externalIcon,
  children,
  ...buttonProps
}: ComponentProps<typeof Button> & { url: string; externalIcon?: boolean }) {
  return (
    <Button asChild {...buttonProps}>
      {isInternalWikiUrl(url) ? (
        <Link href={toRouterPath(url)}>{children}</Link>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {children}
          {externalIcon && <ExternalLink aria-hidden />}
        </a>
      )}
    </Button>
  );
}
