"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Card } from "~/components/ui/card";
import { STANDING_HREF } from "~/lib/thinkpages-forum/links";
import { createUrl } from "~/lib/utils/url-utils";

const SIGN_IN = "Sign in";

/** A forum ban, in the server's words, with the way to appeal it (the member's standing on the forum home). */
export function BanNotice({ notice }: { notice: string }) {
  return (
    <Card content="signal" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
      <p className="text-callout text-label min-w-0 flex-1">{notice}</p>
      <Link href={STANDING_HREF} className="text-callout text-tint shrink-0 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
        Appeal
      </Link>
    </Card>
  );
}

/**
 * The sign-in link; signing in brings the visitor back to this page with its query (`?realm=`, `?page=`), P3.
 * createUrl: the redirect is a plain URL.
 */
export function SignInLink() {
  const pathname = usePathname();
  const query = useSearchParams()?.toString();
  const here = query ? `${pathname}?${query}` : pathname;
  return (
    <Link
      href={`/sign-in?redirect_url=${encodeURIComponent(createUrl(here))}`}
      className="text-tint hover:underline"
    >
      {SIGN_IN}
    </Link>
  );
}

/** A posting notice as text; an anonymous visitor's leading "Sign in" is a link to sign in. */
export function NoticeText({ notice }: { notice: string }) {
  if (!notice.startsWith(SIGN_IN)) return notice;
  return (
    <>
      <SignInLink />
      {notice.slice(SIGN_IN.length)}
    </>
  );
}

/**
 * Why the viewer may not post here: the ban notice when a ban is the reason (the server's flag, T0-18), else the
 * server's notice as a plain line.
 */
export function ForumNotice({ notice, banned }: { notice: string; banned: boolean }) {
  if (banned) return <BanNotice notice={notice} />;
  return (
    <p className="text-footnote text-label-secondary">
      <NoticeText notice={notice} />
    </p>
  );
}
