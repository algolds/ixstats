"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Page as FileText,
  Printer,
  NavArrowRight as ChevronRight,
  ArrowLeft,
  ShareAndroid as Share2,
  Check,
  Calendar,
  Component as Layers,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";
import type { DocumentHeading, DocumentMeta } from "~/lib/markdown-document";

interface NavLink {
  href: string;
  label: string;
}

export interface DocumentLayoutProps {
  meta: DocumentMeta;
  sections: DocumentHeading[];
  back: NavLink;
  children: ReactNode;
}

const navLink = (href: string | undefined, label: string | undefined): NavLink | null =>
  href && label ? { href, label } : null;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top: y, behavior: "smooth" });
}

function useActiveSection(sections: DocumentHeading[]) {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;
      const current = [...sections].reverse().find((sec) => {
        const el = document.getElementById(sec.id);
        return el !== null && el.offsetTop <= scrollPosition;
      });
      if (current) setActiveSection(current.id);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  return [activeSection, setActiveSection] as const;
}

/** Page chrome for markdown documents: breadcrumb, hero, table of contents, prev/next. */
export function DocumentLayout({ meta, sections, back, children }: DocumentLayoutProps) {
  const [activeSection, setActiveSection] = useActiveSection(sections);
  const [copied, setCopied] = useState(false);
  const prev = navLink(meta.prevHref, meta.prevLabel) ?? back;
  const next = navLink(meta.nextHref, meta.nextLabel);

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToSection = (id: string) => {
    scrollToSection(id);
    setActiveSection(id);
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb & Actions Bar */}
        <div className="border-border/50 mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Link
              href={back.href}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors active:scale-[0.97]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {back.label}
            </Link>
            <ChevronRight className="text-muted-foreground/40 h-3 w-3" />
            <span className="text-foreground font-medium">{meta.badge}</span>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground h-8 text-xs active:scale-[0.97]"
            >
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Share2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Share"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground h-8 text-xs active:scale-[0.97]"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="mb-8"
        >
          <CutoutCard className="border-border bg-card/75 shadow-xs backdrop-blur-xl">
            <CutoutCardContent className="space-y-4 p-6 sm:p-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    {meta.badge}
                  </Badge>
                  {meta.version && (
                    <Badge
                      variant="outline"
                      className="border-border bg-muted/30 text-muted-foreground px-2.5 py-0.5 font-mono text-xs"
                    >
                      <Layers className="mr-1 h-3 w-3" />
                      {meta.version}
                    </Badge>
                  )}
                </div>
                {meta.lastUpdated && (
                  <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      Effective: <strong className="text-foreground">{meta.lastUpdated}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div>
                <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  {meta.title}
                </h1>
                <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed sm:text-base">
                  {meta.description}
                </p>
              </div>
            </CutoutCardContent>
          </CutoutCard>
        </motion.div>

        {/* Mobile Quick Section Navigation */}
        {sections.length > 0 && (
          <div className="mb-6 lg:hidden print:hidden">
            <div className="border-border bg-card/80 rounded-xl border p-3 backdrop-blur-md">
              <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                Quick Navigation
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => goToSection(section.id)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-[color,background-color,border-color] active:scale-[0.97] ${
                      activeSection === section.id
                        ? "border-amber-500/30 bg-amber-500/15 font-semibold text-amber-600 dark:text-amber-400"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Sticky Table of Contents */}
          <div className="sticky top-[calc(var(--shell-top-offset)+1rem)] hidden lg:col-span-4 lg:block print:hidden">
            <div className="border-border bg-card/60 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-xl">
              <div className="border-border/50 flex items-center justify-between border-b pb-3">
                <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                  <FileText className="h-4 w-4 text-amber-500" />
                  Table of Contents
                </h3>
                <span className="text-muted-foreground font-mono text-xs">
                  {sections.length} Sections
                </span>
              </div>

              <nav className="space-y-1">
                {sections.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => goToSection(section.id)}
                      className={`group flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left text-xs transition-[color,background-color,border-color] active:scale-[0.98] ${
                        isActive
                          ? "border-amber-500/20 bg-amber-500/10 font-semibold text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          isActive
                            ? "bg-amber-500"
                            : "bg-muted-foreground/40 group-hover:bg-foreground"
                        }`}
                      />
                      <span className="min-w-0 flex-1 leading-snug">{section.title}</span>
                    </button>
                  );
                })}
              </nav>

              {meta.contact && (
                <div className="border-border/40 text-muted-foreground border-t pt-3 text-xs leading-relaxed">
                  Questions or legal inquiries? Reach out to{" "}
                  <a
                    href={`mailto:${meta.contact}`}
                    className="font-medium text-amber-600 underline hover:opacity-80 dark:text-amber-400"
                  >
                    {meta.contact}
                  </a>
                </div>
              )}
            </div>
          </div>

          <main className="lg:col-span-8">
            <CutoutCard className="border-border bg-card/60 shadow-xs backdrop-blur-xl">
              <CutoutCardContent className="p-6 sm:p-8">{children}</CutoutCardContent>
            </CutoutCard>

            <div className="mt-8 flex items-center justify-between gap-4 text-sm print:hidden">
              <Link
                href={prev.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ← {prev.label}
              </Link>
              {next && (
                <Link
                  href={next.href}
                  className="font-medium text-amber-600 transition-colors hover:opacity-80 dark:text-amber-400"
                >
                  {next.label} →
                </Link>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
