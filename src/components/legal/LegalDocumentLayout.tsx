"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  FileText,
  Shield,
  Printer,
  ChevronRight,
  ArrowLeft,
  Share2,
  Check,
  Calendar,
  Layers,
  UserCheck,
  ShieldAlert,
  Globe2,
  Coins,
  Scale,
  Database,
  EyeOff,
  Server,
  Cookie,
  UserX,
  Lock,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";

export interface LegalSectionItem {
  id: string;
  title: string;
  summary?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "acceptance-eligibility": UserCheck,
  "intellectual-property": Sparkles,
  "acceptable-use": ShieldAlert,
  "third-party-services": Globe2,
  "virtual-assets-disclaimers": Coins,
  "termination-governing-law": Scale,
  "data-collected": Database,
  "how-we-use-data": EyeOff,
  "subprocessors-storage": Server,
  "cookies-local-storage": Cookie,
  "user-rights-erasure": UserX,
  "security-contact": Lock,
};

export interface LegalDocumentLayoutProps {
  title: string;
  subtitle: string;
  badge: string;
  lastUpdated: string;
  version?: string;
  sections: LegalSectionItem[];
  children: ReactNode;
}

export function LegalDocumentLayout({
  title,
  subtitle,
  badge,
  lastUpdated,
  version = '1.0 "Ogma"',
  sections,
  children,
}: LegalDocumentLayoutProps) {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        if (!sec) continue;
        const el = document.getElementById(sec.id);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(sec.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-amber-500/20 selection:text-amber-600 dark:selection:text-amber-400">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Breadcrumb & Actions Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/"
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground active:scale-[0.97]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
            <span className="font-medium text-foreground">{badge}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="h-8 border-border bg-card/60 text-xs text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.97] transition-all"
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Share
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 border-border bg-card/60 text-xs text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.97] transition-all print:hidden"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>

        {/* Hero Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="mb-8"
        >
          <CutoutCard
            texture="triangular"
            textureOpacity={0.02}
            className="border-border bg-card/75 backdrop-blur-xl shadow-xs"
          >
            <CutoutCardContent className="p-6 sm:p-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
                  >
                    <Shield className="mr-1.5 h-3.5 w-3.5" />
                    {badge}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-border bg-muted/30 px-2.5 py-0.5 text-xs font-mono text-muted-foreground"
                  >
                    <Layers className="mr-1 h-3 w-3" />
                    {version}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  <span>
                    Effective: <strong className="text-foreground">{lastUpdated}</strong>
                  </span>
                </div>
              </div>

              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {subtitle}
                </p>
              </div>
            </CutoutCardContent>
          </CutoutCard>
        </motion.div>

        {/* Mobile Quick Section Navigation */}
        <div className="mb-6 lg:hidden">
          <div className="rounded-xl border border-border bg-card/80 p-3 backdrop-blur-md">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-amber-500" />
              Quick Navigation
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97] ${
                      isActive
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Sticky TOC + Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sticky Desktop Sidebar */}
          <div className="hidden lg:block lg:col-span-4 sticky top-24">
            <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  Table of Contents
                </h3>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {sections.length} Sections
                </span>
              </div>

              <nav className="space-y-1">
                {sections.map((section) => {
                  const isActive = activeSection === section.id;
                  const Icon = ICON_MAP[section.id];

                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`group flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left text-xs transition-all active:scale-[0.98] ${
                        isActive
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20 shadow-xs"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                      }`}
                    >
                      {Icon ? (
                        <Icon
                          className={`h-4 w-4 shrink-0 mt-0.5 transition-colors ${
                            isActive
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground/60 group-hover:text-foreground"
                          }`}
                        />
                      ) : (
                        <div
                          className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 transition-colors ${
                            isActive ? "bg-amber-500" : "bg-muted-foreground/40 group-hover:bg-foreground"
                          }`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="leading-snug truncate">{section.title}</p>
                        {section.summary && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground/70 line-clamp-1 group-hover:text-muted-foreground">
                            {section.summary}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground leading-relaxed">
                Questions or legal inquiries? Reach out to{" "}
                <a
                  href="mailto:admin@ixwiki.com"
                  className="text-amber-600 dark:text-amber-400 underline hover:opacity-80 font-medium"
                >
                  admin@ixwiki.com
                </a>
              </div>
            </div>
          </div>

          {/* Main Legal Content */}
          <main className="lg:col-span-8 space-y-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
