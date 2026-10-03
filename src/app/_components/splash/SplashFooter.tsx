"use client";

import React from "react";
import Link from "next/link";
import {
  Shield,
  Sparks as Sparkles,
  ChatBubble as MessageCircle,
  OpenBook as BookOpen,
} from "iconoir-react";
import { VERSIONS } from "~/lib/buildVersion";

export function SplashFooter() {
  const versionString = `v${VERSIONS.platform.major}.${VERSIONS.platform.minor}.${VERSIONS.platform.patch} "${VERSIONS.platform.release}"`;

  return (
    <footer className="border-separator text-label-secondary mt-16 border-t pt-8 pb-12">
      <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex flex-col items-center gap-2 text-center md:items-start md:text-left">
          <div className="flex items-center gap-2">
            <span className="text-headline text-label">IxStates</span>
            <span className="rounded-control-sm border-separator bg-fill-4 text-footnote text-label-secondary font-data border px-2 py-0.5">
              {versionString}
            </span>
          </div>
          <p className="text-footnote text-label-secondary max-w-sm">
            An economic simulation for worldbuilders, run by the Ixnay community.
          </p>
        </div>

        <div className="text-caption flex flex-wrap items-center justify-center gap-6">
          <Link
            href="/terms"
            className="text-label-secondary hover:text-tint flex items-center gap-2 transition-colors"
          >
            <Shield aria-hidden className="h-3.5 w-3.5" />
            Terms of service
          </Link>
          <Link
            href="/privacy"
            className="text-label-secondary hover:text-tint flex items-center gap-2 transition-colors"
          >
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            Privacy policy
          </Link>
          <Link
            href="/help"
            className="text-label-secondary hover:text-tint flex items-center gap-2 transition-colors"
          >
            <BookOpen aria-hidden className="h-3.5 w-3.5" />
            Help
          </Link>
          <a
            href="https://discord.gg/mgXAEYdqkd"
            target="_blank"
            rel="noopener noreferrer"
            className="text-label-secondary hover:text-tint flex items-center gap-2 transition-colors"
          >
            <MessageCircle aria-hidden className="h-3.5 w-3.5" />
            Discord
          </a>
        </div>
      </div>

      <div className="border-separator text-footnote text-label-secondary mt-8 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
        <p>© 2026 Ixnay Community / IxWiki. Non-commercial creative platform.</p>
        <p>Public lore licensed under CC-BY-SA 4.0. Age 16+ platform.</p>
      </div>
    </footer>
  );
}
