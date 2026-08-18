"use client";

import React from "react";
import Link from "next/link";
import { Shield, Sparkles, MessageCircle, BookOpen } from "lucide-react";
import { VERSIONS } from "~/lib/buildVersion";

export function SplashFooter() {
  const versionString = `v${VERSIONS.platform.major}.${VERSIONS.platform.minor}.${VERSIONS.platform.patch} "${VERSIONS.platform.release}"`;

  return (
    <footer className="mt-16 border-t border-white/10 pt-8 pb-12 text-slate-400">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left branding */}
        <div className="flex flex-col items-center md:items-start gap-1.5 text-center md:text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-white text-base">
              IxStates
            </span>
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-mono text-amber-400">
              {versionString}
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm">
            Nations, economics, lore &amp; procedural worlds. Operated by the Ixnay Community.
          </p>
        </div>

        {/* Center / Right Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium">
          <Link
            href="/terms"
            className="flex items-center gap-1.5 text-slate-300 transition-colors hover:text-amber-400"
          >
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className="flex items-center gap-1.5 text-slate-300 transition-colors hover:text-amber-400"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            Privacy Policy
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-1.5 text-slate-300 transition-colors hover:text-amber-400"
          >
            <BookOpen className="h-3.5 w-3.5 text-blue-400" />
            Help &amp; Guides
          </Link>
          <a
            href="https://discord.gg/mgXAEYdqkd"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-300 transition-colors hover:text-indigo-400"
          >
            <MessageCircle className="h-3.5 w-3.5 text-indigo-400" />
            Discord
          </a>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-6 text-[11px] text-slate-400">
        <p>© 2026 Ixnay Community / IxWiki. Non-commercial creative platform.</p>
        <p>Public lore licensed under CC-BY-SA 4.0. Age 16+ platform.</p>
      </div>
    </footer>
  );
}
