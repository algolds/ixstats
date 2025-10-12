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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/help"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Help Center
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Icon className={`w-8 h-8 ${iconColor}`} />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{title}</h1>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300">{description}</p>
        </div>

        <div className="prose prose-slate dark:prose-invert prose-blue max-w-none">
          <div className="bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10 rounded-xl p-8 backdrop-blur-xl space-y-6">
            {children}
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          {prevLink ? (
            <Link
              href={prevLink.href}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              ← {prevLink.label}
            </Link>
          ) : (
            <Link
              href="/help"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              ← Back to Help Center
            </Link>
          )}
          {nextLink && (
            <Link
              href={nextLink.href}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
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
    <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg p-4">
      <h3 className="text-blue-900 dark:text-blue-300 font-semibold mb-1">{title}</h3>
      <div className="text-blue-800 dark:text-blue-100/80 text-sm">{children}</div>
    </div>
  );
}

export function WarningBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-lg p-4">
      <h3 className="text-amber-900 dark:text-amber-300 font-semibold mb-1">{title}</h3>
      <div className="text-amber-800 dark:text-amber-100/80 text-sm">{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{title}</h2>}
      {children}
    </section>
  );
}
