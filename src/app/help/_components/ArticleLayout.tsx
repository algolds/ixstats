"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

interface ArticleLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  children: React.ReactNode;
  prevLink?: { href: string; label: string };
  nextLink?: { href: string; label: string };
}

export function ArticleLayout({
  title,
  description,
  icon: Icon,
  iconColor = "text-blue-600 dark:text-blue-400",
  children,
  prevLink,
  nextLink,
}: ArticleLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/help"
          className="mb-6 inline-flex items-center gap-2 text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Help Center
        </Link>

        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <Icon className={`h-8 w-8 ${iconColor}`} />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{title}</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">{description}</p>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            {children}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          {prevLink ? (
            <Link
              href={prevLink.href}
              className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              ← {prevLink.label}
            </Link>
          ) : (
            <Link
              href="/help"
              className="text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              ← Back to Help Center
            </Link>
          )}
          {nextLink && (
            <Link
              href={nextLink.href}
              className="text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {nextLink.label} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
      <h3 className="mb-1 font-semibold text-blue-900 dark:text-blue-300">{title}</h3>
      <div className="text-sm text-blue-800 dark:text-blue-100/80">{children}</div>
    </div>
  );
}

export function WarningBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <h3 className="mb-1 font-semibold text-amber-900 dark:text-amber-300">{title}</h3>
      <div className="text-sm text-amber-800 dark:text-amber-100/80">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>}
      {children}
    </section>
  );
}
