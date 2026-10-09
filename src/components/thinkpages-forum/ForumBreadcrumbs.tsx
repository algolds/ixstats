"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { FORUM_HOME, forumHomeHref } from "~/lib/thinkpages-forum/links";

export interface ForumCrumb {
  label: string;
  href?: string;
}

/** The trail's start: ThinkPages (the forum home), then the realm (opening its section there) for a realm category. */
export function forumTrail(realm: { slug: string; name: string } | null | undefined): ForumCrumb[] {
  const home = { label: "ThinkPages", href: FORUM_HOME };
  return realm ? [home, { label: realm.name, href: forumHomeHref(realm.slug) }] : [home];
}

/** Where a forum page sits (ThinkPages, realm, category, thread). Every item but the last, the current page, links. */
export function ForumBreadcrumbs({ items }: { items: readonly ForumCrumb[] }) {
  const last = items.length - 1;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {i < last && item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
