import type { ComponentProps } from "react";
import Link from "next/link";
import { OpenNewWindow as ExternalLink } from "iconoir-react";
import { Button } from "~/components/ui/button";

/** In-app wiki pages (WikiOS paths) open via `Link`; anything else opens in a new tab. */
export const isInternalWikiUrl = (url: string) => url.startsWith("/") || url.includes("/wiki/");

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
        <Link href={url}>{children}</Link>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {children}
          {externalIcon && <ExternalLink aria-hidden />}
        </a>
      )}
    </Button>
  );
}
