"use client";

import React, { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
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
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/shell/PageHeader";
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
        <PageHeader
          title={meta.title ?? ""}
          subtitle={meta.description}
          back={{ href: back.href, label: back.label }}
          actions={
            <div className="flex items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                {copied ? <Check className="text-green" /> : <Share2 />}
                {copied ? "Copied" : "Share"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
            </div>
          }
          className="-mx-2"
        />

        <div className="text-footnote text-label-secondary mb-8 flex flex-wrap items-center gap-3 px-2">
          <Badge variant="outline">
            <FileText aria-hidden />
            {meta.badge}
          </Badge>
          {meta.version && (
            <Badge variant="outline">
              <Layers aria-hidden />
              {meta.version}
            </Badge>
          )}
          {meta.lastUpdated && (
            <span className="flex items-center gap-1.5">
              <Calendar aria-hidden className="size-3.5" />
              Effective <strong className="text-label tabular-nums">{meta.lastUpdated}</strong>
            </span>
          )}
        </div>

        {/* Mobile Quick Section Navigation */}
        {sections.length > 0 && (
          <div className="mb-6 lg:hidden print:hidden">
            <div className="border-border bg-card rounded-xl border p-3">
              <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <FileText className="text-tint h-3.5 w-3.5" />
                Quick navigation
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => goToSection(section.id)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-[color,background-color,border-color] ${
                      activeSection === section.id
                        ? "border-tint/30 bg-tint-fill text-tint font-semibold"
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
          {/* Sticky Table of contents */}
          <div className="sticky top-[calc(var(--shell-top-offset)+1rem)] hidden lg:col-span-4 lg:block print:hidden">
            <div className="border-border bg-card space-y-4 rounded-2xl border p-5">
              <div className="border-border/50 flex items-center justify-between border-b pb-3">
                <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
                  <FileText className="text-tint h-4 w-4" />
                  Table of contents
                </h3>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {sections.length} sections
                </span>
              </div>

              <nav className="space-y-1">
                {sections.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => goToSection(section.id)}
                      className={`group flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left text-xs transition-[color,background-color,border-color] ${
                        isActive
                          ? "border-tint/20 bg-tint-fill text-tint font-semibold"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          isActive ? "bg-tint" : "bg-muted-foreground/40 group-hover:bg-foreground"
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
                    className="text-tint font-medium underline hover:opacity-80"
                  >
                    {meta.contact}
                  </a>
                </div>
              )}
            </div>
          </div>

          <main className="lg:col-span-8">
            <Card padding="lg">{children}</Card>

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
                  className="text-tint font-medium transition-colors hover:opacity-80"
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
