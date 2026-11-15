import React, { useState } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { navigateWithBasePath } from "~/lib/base-path";
import { useRouter } from "next/navigation";
import {
  OpenBook as BookOpen,
  User,
  Page as FileText,
  ClockRotateRight as History,
} from "iconoir-react";
import { HaloEmpty, HaloViewHeader, HaloWell } from "~/components/halo/views/shared/HaloViewParts";
import type { PausedSession } from "../types";
import { pageRefPath } from "~/lib/wiki-os/page-ref";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";
import { Button } from "~/components/ui/button";

// This view is loaded with `ssr: false` (WikiHalo), so its first render is already in the browser.
function readScratchpad(): string {
  try {
    return localStorage.getItem("wikios:scratchpad") || "";
  } catch {
    return ""; // restricted storage
  }
}

function readPausedSessions(): PausedSession[] {
  try {
    const savedSessions = localStorage.getItem("wikios:pausedSessions");
    return savedSessions ? (JSON.parse(savedSessions) as PausedSession[]) : [];
  } catch {
    return []; // restricted storage or invalid JSON
  }
}

interface WikiProfileViewProps {
  onClose: () => void;
}

export function WikiProfileView({ onClose }: WikiProfileViewProps) {
  const { user } = useUser();
  const router = useRouter();
  const { recentArticles, restoreSession } = useWikiContext();

  const [scratchpad, setScratchpad] = useState(readScratchpad);
  const [pausedSessions] = useState(readPausedSessions);

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
  });
  const handle = userProfile?.handle ?? null;

  const handleScratchpadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScratchpad(val);
    try {
      localStorage.setItem("wikios:scratchpad", val);
    } catch {
      // ignore
    }
  };

  const handleResumeSession = (session: PausedSession) => {
    onClose();
    restoreSession(session);
  };

  return (
    <div className="space-y-3 overflow-hidden p-3">
      <HaloViewHeader
        leading={<FileText className="text-wiki size-4 shrink-0" aria-hidden />}
        title="Wiki workspace"
        trailing={
          handle ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                navigateWithBasePath(getWikiProfilePath(handle), router);
              }}
              className="text-label-secondary hover:text-label"
            >
              <User aria-hidden className="text-blue size-3.5" />
              <span>Contributions</span>
            </Button>
          ) : undefined
        }
        onClose={onClose}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Left Column: Paused Sessions + Recent Pages */}
        <div className="space-y-3">
          <HaloWell className="space-y-3">
            <div className="text-label-secondary text-footnote flex items-center gap-2">
              <History className="h-3 w-3" />
              <span>Saved and paused sessions</span>
            </div>

            {pausedSessions.length === 0 ? (
              <HaloEmpty
                icon={<BookOpen />}
                title="No paused sessions yet"
                message="Your reading and editing progress appears here."
                className="py-4"
              />
            ) : (
              <div className="space-y-2">
                {pausedSessions.map((session) => (
                  <div
                    key={pageRefPath(session)}
                    className="bg-fill-4 hover:bg-fill-3 rounded-control flex flex-col gap-2 p-3 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label text-caption truncate font-semibold">
                        {session.title}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResumeSession(session)}
                      >
                        Resume
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-fill-3 h-1 flex-1 rounded-full">
                        <div
                          className="bg-blue h-full rounded-full"
                          style={{ width: `${session.scrollPercent}%` }}
                        />
                      </div>
                      <span className="text-label-secondary text-caption font-semibold tabular-nums">
                        {session.scrollPercent}% read
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </HaloWell>

          <HaloWell className="space-y-2">
            <div className="text-label-secondary text-footnote flex items-center gap-2">
              <BookOpen className="h-3 w-3" />
              <span>Recently visited pages</span>
            </div>
            {recentArticles.length === 0 ? (
              <HaloEmpty title="No pages visited recently" className="py-3" />
            ) : (
              <div className="space-y-1">
                {recentArticles.slice(0, 4).map((page) => (
                  <Button
                    type="button"
                    variant="secondary"
                    key={pageRefPath(page)}
                    onClick={() => {
                      onClose();
                      restoreSession(page);
                    }}
                    className="w-full justify-start"
                  >
                    <History className="text-blue h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{page.title}</span>
                  </Button>
                ))}
              </div>
            )}
          </HaloWell>
        </div>

        {/* Right Column: Quick Notes / Scratchpad */}
        <HaloWell className="flex flex-col space-y-2">
          <div className="text-label-secondary text-footnote flex items-center gap-2">
            <FileText className="h-3 w-3" />
            <span>Wiki scratchpad</span>
          </div>
          <div className="relative flex-1">
            <textarea
              value={scratchpad}
              onChange={handleScratchpadChange}
              placeholder="Jot down quick worldbuilding notes, drafts, task lists, or article revisions here… (auto-saves)"
              className="bg-fill-4 text-label placeholder:text-label-tertiary focus:bg-fill-3 rounded-control text-footnote focus-visible:outline-tint h-full min-h-[180px] w-full resize-none p-3 transition-[color,background-color,box-shadow,opacity,scale,translate] outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ scrollbarWidth: "thin" }}
            />
          </div>
        </HaloWell>
      </div>
    </div>
  );
}
