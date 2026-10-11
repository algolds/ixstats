"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PREFIX = "#post-";

/** A link to a message of the board (`#post-<id>`), for the feed to find and scroll to. */
export interface MessageSeek {
  /** The linked message's id. */
  postId: string;
  /** The feed shows the message: scrolls to it, once per link. */
  found: () => void;
}

const linkedPost = (): string | null => {
  const { hash } = window.location;
  return hash.startsWith(PREFIX) && hash.length > PREFIX.length ? hash.slice(PREFIX.length) : null;
};

/**
 * The message a permalink, a notice or a "Replying to" link points at (`#post-<id>`), or null. The feed pages back
 * until it has that message (it may be older than the page the board opens with) and calls `found` once it is on
 * screen; the scroll happens once per link, so a refetch or a new message leaves the reader where they are.
 */
export function useScrollToMessageHash(): MessageSeek | null {
  const [postId, setPostId] = useState<string | null>(null);
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const read = () => setPostId(linkedPost());
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const found = useCallback(() => {
    if (postId === null || handled.current === postId) return;
    handled.current = postId;
    document.getElementById(`post-${postId}`)?.scrollIntoView({ block: "start" });
  }, [postId]);
  return useMemo(() => (postId === null ? null : { postId, found }), [postId, found]);
}
