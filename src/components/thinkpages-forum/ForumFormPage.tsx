import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { ForumPage } from "./shell";

/** The chrome of a page that starts a thread (the new thread and new advert forms): the shell and its form column. */
export function ForumFormPage({
  title,
  breadcrumbs,
  back,
  children,
}: {
  title: string;
  breadcrumbs?: string;
  back: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <ForumPage title={title} breadcrumbs={breadcrumbs} back={back}>
      <div className="flex max-w-3xl min-w-0 flex-col gap-4">{children}</div>
    </ForumPage>
  );
}

/** A thread whose first post is still being formatted opens on request. */
export function OpenStartedLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="secondary" className="pointer-coarse:min-h-11">
      <Link href={href}>{label}</Link>
    </Button>
  );
}
