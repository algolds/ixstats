"use client";
/**
 * ArticleWidgets: the React widgets the reader mounts into an IxWiki article's live HTML: coordinate pills, map
 * embeds, live stats and `Template:Sister` embeds (at most `MAX_SISTER_EMBEDS`). Another wiki's page is that wiki's
 * HTML, read-only: it gets no placeholder pass and mounts nothing.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { api } from "~/trpc/react";
import type { WikiSource } from "~/lib/wiki-os/config";
import {
  CoordsPill,
  DynamicStatSpan,
  extractStatKeys,
  injectPlaceholderElements,
} from "./ArticlePlaceholders";
import { CoordinatesMapEmbed } from "./article-lazy";
import { readPortalTargets, type PortalTarget } from "./placeholder-dom";
import { SisterEmbed } from "./SisterEmbed";
import { useStatValues } from "./useStatValues";

/**
 * `html` after the placeholder pass, once `active` (hydrated, on an IxWiki page); as it is before that, so the
 * hydrating render matches the server's.
 */
export function useWidgetHtml<T extends string | null>(html: T, active: boolean): T {
  return useMemo(
    () => (html && active ? (injectPlaceholderElements(html) as T) : html),
    [html, active]
  );
}

function useViewerCentroid(enabled: boolean): { lat: number; lng: number } | null {
  const { data: currentUserData } = api.users.getCurrentUserWithRole.useQuery(undefined, {
    enabled,
  });
  const countryId = currentUserData?.user?.country?.id || "";
  const { data: viewerCountryData } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: enabled && !!countryId }
  );
  return useMemo(() => {
    if (!viewerCountryData?.centroid) return null;
    const c = viewerCountryData.centroid as { lat: number; lng: number } | [number, number];
    if (Array.isArray(c)) return { lng: c[0] || 0, lat: c[1] || 0 };
    return { lat: c.lat || 0, lng: c.lng || 0 };
  }, [viewerCountryData]);
}

interface ArticleWidgetPortalsProps {
  contentRef: RefObject<HTMLDivElement | null>;
  source: WikiSource;
  isAuthenticated: boolean;
  /** The article's body and infobox HTML as stored (their stat keys). */
  contentHtml: string;
  infoboxHtml: string | null;
  /** The same HTML as rendered: the targets are read again whenever it changes. */
  renderedHtml: string;
  renderedInfoboxHtml: string | null;
}

export function ArticleWidgetPortals({
  contentRef,
  source,
  isAuthenticated,
  contentHtml,
  infoboxHtml,
  renderedHtml,
  renderedInfoboxHtml,
}: ArticleWidgetPortalsProps) {
  const ownPage = source === "ixwiki";
  const statKeys = useMemo(
    () =>
      ownPage ? extractStatKeys(infoboxHtml ? `${contentHtml}${infoboxHtml}` : contentHtml) : [],
    [ownPage, contentHtml, infoboxHtml]
  );
  const statsData = useStatValues(statKeys);
  const viewerCentroid = useViewerCentroid(isAuthenticated && ownPage);
  const [targets, setTargets] = useState<PortalTarget[]>([]);
  // A box is emptied once, when its embed mounts: until then the server's link box shows. Emptied again, it would
  // lose the embed React rendered into it.
  const claimed = useRef(new WeakSet<Element>());

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const found = readPortalTargets(container, source);
    for (const target of found) {
      if (target.type !== "sister" || claimed.current.has(target.element)) continue;
      claimed.current.add(target.element);
      target.element.replaceChildren();
    }
    setTargets(found);
  }, [contentRef, source, renderedHtml, renderedInfoboxHtml]);

  return targets.map((target, index) => {
    const key = String(index);
    switch (target.type) {
      case "coords":
        return createPortal(
          <CoordsPill {...target.data} viewerCentroid={viewerCentroid} />,
          target.element,
          key
        );
      case "map-embed":
        return createPortal(<CoordinatesMapEmbed {...target.data} />, target.element, key);
      case "stat":
        return createPortal(
          <DynamicStatSpan placeholderKey={target.data.key} data={statsData[target.data.key]} />,
          target.element,
          key
        );
      case "sister":
        return createPortal(<SisterEmbed request={target.data} />, target.element, key);
    }
  });
}
