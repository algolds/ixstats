"use client";

import { useEffect, useState, type RefObject } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useHtmlMarkup } from "~/components/wiki-os/shared/useHtmlMarkup";
import { embedTitle, embedWidth } from "~/lib/thinkpages-forum/post-html";
import { ARTICLE_STYLE_ROOT_CLASS } from "~/lib/utils/scope-template-styles";
import { getImageUrl } from "~/lib/wiki-os/transformers/image-url";
import { api } from "~/trpc/react";

// The summary card brings the Dashboard feed's article actions with it; load them only for a post that embeds one.
const InlineWikiArticlePreview = dynamic(
  () =>
    import("~/components/dashboard/sections/feed/InlineWikiArticlePreview").then(
      (m) => m.InlineWikiArticlePreview
    ),
  { ssr: false }
);

type EmbedKind = "summary" | "infobox" | "image";

/** One valid embed in the post: its node and what to show there. */
interface Slot {
  node: HTMLElement;
  kind: EmbedKind;
  title: string;
  width: number | null;
}

const EMBED = ".forum-wiki-embed[data-wiki-embed]";
/** What an embed shows is wiki content; an embed inside it is never hydrated. */
const VIEW = ".forum-embed-view";
const FILE_PREFIX = /^(?:File|Image):/i;

/**
 * An embed node as a slot, or null. Every attribute is read from the DOM and checked again: any member can write
 * `class="forum-wiki-embed"` with values of their choosing, so nothing here is trusted, spliced into HTML or sent
 * to the wiki unless it passes. A null leaves the plain link the post already holds.
 */
function slotOf(node: HTMLElement): Slot | null {
  const kind = node.getAttribute("data-wiki-embed");
  const title = embedTitle(node.getAttribute("data-wiki-title"));
  const width = embedWidth(node.getAttribute("data-width"));
  if (!title || !width) return null;
  if (kind === "image") {
    return FILE_PREFIX.test(title) ? { node, kind, title, width: width.width } : null;
  }
  return kind === "summary" || kind === "infobox" ? { node, kind, title, width: null } : null;
}

function readSlots(root: HTMLElement): Slot[] {
  const slots: Slot[] = [];
  for (const node of Array.from(root.querySelectorAll<HTMLElement>(EMBED))) {
    const slot = node.closest(VIEW) ? null : slotOf(node);
    if (slot) slots.push(slot);
  }
  return slots;
}

const sameSlots = (a: readonly Slot[], b: readonly Slot[]) =>
  a.length === b.length &&
  a.every(
    (slot, i) =>
      slot.node === b[i]?.node &&
      slot.kind === b[i].kind &&
      slot.title === b[i].title &&
      slot.width === b[i].width
  );

function InfoboxEmbed({ title }: { title: string }) {
  const { data } = api.wikios.getArticleHtml.useQuery(
    { title },
    { staleTime: 30 * 60_000, retry: false }
  );
  const markup = useHtmlMarkup(data?.infoboxHtml ?? "");
  if (!data?.infoboxHtml) return null;
  return (
    <aside className="forum-infobox">
      <div className={ARTICLE_STYLE_ROOT_CLASS} dangerouslySetInnerHTML={markup} />
    </aside>
  );
}

function ImageEmbed({ title, width }: { title: string; width: number | null }) {
  const file = title.replace(FILE_PREFIX, "");
  return (
    <img
      src={getImageUrl(title)}
      alt={file}
      loading="lazy"
      {...(width === null ? {} : { width })}
      className="forum-embed-image"
    />
  );
}

function EmbedView({ slot }: { slot: Slot }) {
  return (
    <div className="forum-embed-view">
      {slot.kind === "summary" ? <InlineWikiArticlePreview title={slot.title} /> : null}
      {slot.kind === "infobox" ? <InfoboxEmbed title={slot.title} /> : null}
      {slot.kind === "image" ? <ImageEmbed title={slot.title} width={slot.width} /> : null}
    </div>
  );
}

/**
 * Hydrates the wiki embeds inside `root` (a post body): each valid `.forum-wiki-embed` gets its article summary,
 * infobox or image next to the plain link, which CSS hides once the embed has content. The body re-renders its HTML
 * as React elements after mounting, so the embeds are looked for again whenever its DOM changes.
 */
export function WikiEmbeds({ root }: { root: RefObject<HTMLElement | null> }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const scan = () =>
      setSlots((previous) => {
        const next = readSlots(element);
        return sameSlots(previous, next) ? previous : next;
      });
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [root]);
  return (
    <>
      {slots.map((slot, index) =>
        createPortal(<EmbedView slot={slot} />, slot.node, `${index}:${slot.title}`)
      )}
    </>
  );
}
