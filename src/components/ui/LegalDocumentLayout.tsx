"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Page as FileText,
  Shield,
  Printer,
  NavArrowRight as ChevronRight,
  ArrowLeft,
  ShareAndroid as Share2,
  Check,
  Calendar,
  Component as Layers,
  UserBadgeCheck as UserCheck,
  ShieldAlert,
  Globe as Globe2,
  Coins,
  ScaleFrameEnlarge as Scale,
  Database,
  EyeClosed as EyeOff,
  Server,
  Cookie,
  UserXmark as UserX,
  Lock,
  Sparks as Sparkles,
} from "iconoir-react";
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
    <div className="bg-background text-foreground min-h-screen selection:bg-amber-500/20 selection:text-amber-600 dark:selection:text-amber-400">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Breadcrumb & Actions Bar */}
        <div className="border-border/50 mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors active:scale-[0.97]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <ChevronRight className="text-muted-foreground/40 h-3 w-3" />
            <span className="text-foreground font-medium">{badge}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground h-8 text-xs transition-all active:scale-[0.97]"
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
              className="border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground h-8 text-xs transition-all active:scale-[0.97] print:hidden"
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
            className="border-border bg-card/75 shadow-xs backdrop-blur-xl"
          >
            <CutoutCardContent className="space-y-4 p-6 sm:p-10">
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
                    className="border-border bg-muted/30 text-muted-foreground px-2.5 py-0.5 font-mono text-xs"
                  >
                    <Layers className="mr-1 h-3 w-3" />
                    {version}
                  </Badge>
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  <span>
                    Effective: <strong className="text-foreground">{lastUpdated}</strong>
                  </span>
                </div>
              </div>

              <div>
                <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                  {title}
                </h1>
                <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed sm:text-base">
                  {subtitle}
                </p>
              </div>
            </CutoutCardContent>
          </CutoutCard>
        </motion.div>

        {/* Mobile Quick Section Navigation */}
        <div className="mb-6 lg:hidden">
          <div className="border-border bg-card/80 rounded-xl border p-3 backdrop-blur-md">
            <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
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
                        ? "border border-amber-500/30 bg-amber-500/15 font-semibold text-amber-600 dark:text-amber-400"
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
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Sticky Desktop Sidebar */}
          <div className="sticky top-24 hidden lg:col-span-4 lg:block">
            <div className="border-border bg-card/60 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-xl">
              <div className="border-border/50 flex items-center justify-between border-b pb-3">
                <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                  <FileText className="h-4 w-4 text-amber-500" />
                  Table of Contents
                </h3>
                <span className="text-muted-foreground font-mono text-[11px]">
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
                          ? "border border-amber-500/20 bg-amber-500/10 font-semibold text-amber-600 shadow-xs dark:text-amber-400"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                      }`}
                    >
                      {Icon ? (
                        <Icon
                          className={`mt-0.5 h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground/60 group-hover:text-foreground"
                          }`}
                        />
                      ) : (
                        <div
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                            isActive
                              ? "bg-amber-500"
                              : "bg-muted-foreground/40 group-hover:bg-foreground"
                          }`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate leading-snug">{section.title}</p>
                        {section.summary && (
                          <p className="text-muted-foreground/70 group-hover:text-muted-foreground mt-0.5 line-clamp-1 text-[11px]">
                            {section.summary}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </nav>

              <div className="border-border/40 text-muted-foreground border-t pt-3 text-[11px] leading-relaxed">
                Questions or legal inquiries? Reach out to{" "}
                <a
                  href="mailto:admin@ixwiki.com"
                  className="font-medium text-amber-600 underline hover:opacity-80 dark:text-amber-400"
                >
                  admin@ixwiki.com
                </a>
              </div>
            </div>
          </div>

          {/* Main Legal Content */}
          <main className="space-y-6 lg:col-span-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
