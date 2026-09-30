"use client";

import { NavArrowLeft, NavArrowRight, CheckCircle, SystemRestart } from "iconoir-react";
import { Button } from "~/components/ui/button";
import type { BuilderSection } from "../../lib/builder-theme";
import { EDITOR_NAV } from "./editor-sections";

interface EditorSectionFooterProps {
  activeSection: BuilderSection;
  onNavigate: (section: BuilderSection) => void;
  /** Review only: final save (confirms warnings) and back to MyCountry. */
  onFinish?: () => void;
  isFinishing?: boolean;
}

/** Previous / next section links at the foot of each editor section. */
export function EditorSectionFooter({
  activeSection,
  onNavigate,
  onFinish,
  isFinishing = false,
}: EditorSectionFooterProps) {
  const index = EDITOR_NAV.findIndex((item) => item.section === activeSection);
  const previous = index > 0 ? EDITOR_NAV[index - 1] : undefined;
  const next = index >= 0 && index < EDITOR_NAV.length - 1 ? EDITOR_NAV[index + 1] : undefined;

  return (
    <nav
      aria-label="Previous and next section"
      className="border-border mt-8 flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        {previous && (
          <Button type="button" variant="outline" onClick={() => onNavigate(previous.section)}>
            <NavArrowLeft aria-hidden="true" className="h-4 w-4" />
            {previous.label}
          </Button>
        )}
      </div>
      <div>
        {next ? (
          <Button type="button" variant="outline" onClick={() => onNavigate(next.section)}>
            {next.label}
            <NavArrowRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        ) : (
          onFinish && (
            <Button type="button" onClick={onFinish} disabled={isFinishing} aria-busy={isFinishing}>
              {isFinishing ? (
                <SystemRestart aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle aria-hidden="true" className="h-4 w-4" />
              )}
              {isFinishing ? "Saving…" : "Save and return to MyCountry"}
            </Button>
          )
        )}
      </div>
    </nav>
  );
}
