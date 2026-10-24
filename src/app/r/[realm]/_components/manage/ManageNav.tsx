"use client";

import { useEffect, useRef } from "react";
import { useScrollSpy } from "~/components/country-profile/useScrollSpy";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";

export interface ManageNavGroup {
  label: string;
  sections: Array<{ id: string; label: string }>;
}

/**
 * The Manage tab's section index. It follows the reader: the section under the reading line is marked
 * current, and the index scrolls itself (never the page) to keep that link in view, sideways in the phone
 * row and down the desktop column.
 */
export function ManageNav({ groups }: { groups: ManageNavGroup[] }) {
  const navRef = useRef<HTMLElement>(null);
  const reduceMotion = useFacetReducedMotion();
  // The reading line sits a little lower than the default so the tail of the section above, under the sticky
  // row, does not keep the index on it.
  const active = useScrollSpy(
    groups.flatMap((g) => g.sections.map((s) => s.id)),
    "-30% 0px -60% 0px"
  );

  useEffect(() => {
    const nav = navRef.current;
    const link = active ? nav?.querySelector<HTMLElement>(`a[href="#${active}"]`) : null;
    if (!nav || !link) return;
    const navBox = nav.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    nav.scrollBy({
      left: linkBox.left + linkBox.width / 2 - (navBox.left + navBox.width / 2),
      top: linkBox.top + linkBox.height / 2 - (navBox.top + navBox.height / 2),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [active, reduceMotion]);

  return (
    <nav
      ref={navRef}
      aria-label="Manage sections"
      // Phones: one sticky scrolling row on chrome, below the Halo band. From lg: the grouped column, sticky,
      // scrolling within itself
      // when taller than the window.
      className="max-lg:facet-chrome z-sticky sticky top-(--shell-top-offset) flex gap-1 overflow-x-auto max-lg:-mx-4 max-lg:px-4 max-lg:py-2 lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:flex-col lg:gap-4 lg:self-start lg:overflow-x-visible lg:overflow-y-auto"
    >
      {groups.map((group) => (
        <div
          key={group.label}
          role="group"
          aria-labelledby={`manage-nav-${group.label}`}
          className="shrink-0"
        >
          <h3
            id={`manage-nav-${group.label}`}
            className="text-footnote text-label hidden px-3 pb-1 font-semibold lg:block"
          >
            {group.label}
          </h3>
          <ul className="flex gap-1 lg:flex-col">
            {group.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "location" : undefined}
                  className="rounded-control text-footnote text-label-secondary hover:bg-fill-4 hover:text-label aria-[current=location]:bg-fill-3 aria-[current=location]:text-label block px-3 py-2 whitespace-nowrap aria-[current=location]:font-medium lg:py-1"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
