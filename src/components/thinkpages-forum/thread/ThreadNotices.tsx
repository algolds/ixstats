"use client";

import { Archive, EyeClosed, Lock } from "iconoir-react";
import { AdvertCard } from "../advert";
import type { ThreadData } from "./types";

function Notice({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="text-callout text-label-secondary flex items-center gap-2 px-1">
      {icon}
      {children}
    </p>
  );
}

/**
 * What the reader should know before the posts: the thread is hidden from members, imported from the old forum, or a
 * Find a Realm advert (its live realm card heads the thread, and an archived realm says why the advert is closed).
 */
export function ThreadNotices({ data }: { data: ThreadData }) {
  const { thread, advert } = data;
  const icon = (Icon: typeof Archive) => <Icon aria-hidden className="size-4 shrink-0" />;
  return (
    <>
      {thread.hidden ? (
        <Notice icon={icon(EyeClosed)}>This thread is hidden from members.</Notice>
      ) : null}
      {typeof thread.xenforoThreadId === "number" ? (
        <Notice icon={icon(Archive)}>Imported from the old forum.</Notice>
      ) : null}
      {advert?.closed ? (
        <Notice icon={icon(Lock)}>
          Realm archived. Its advert is closed until the realm is restored.
        </Notice>
      ) : null}
      {advert ? <AdvertCard realmSlug={advert.realmSlug} /> : null}
    </>
  );
}
