import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Scroll behaviour of the message pane: a new newest message scrolls to the bottom (instantly for a
 * thread just opened, smoothly after), while loading older messages keeps what you were reading in place.
 */
export function useThreadScroll({
  conversationId,
  firstId,
  lastId,
  followNewest,
}: {
  conversationId: string;
  firstId?: string;
  lastId?: string;
  followNewest: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const openedConversation = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    const saved = anchor.current;
    if (!el || !saved) return;
    el.scrollTop = el.scrollHeight - saved.height + saved.top;
    anchor.current = null;
  }, [firstId]);

  useEffect(() => {
    if (!followNewest || !lastId) return;
    const behavior = openedConversation.current === conversationId ? "smooth" : "auto";
    endRef.current?.scrollIntoView({ behavior });
    openedConversation.current = conversationId;
  }, [lastId, conversationId, followNewest]);

  return {
    containerRef,
    endRef,
    /** Call just before older messages are requested. */
    rememberPosition: () => {
      const el = containerRef.current;
      if (el) anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    },
  };
}
