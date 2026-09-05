"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  NavArrowLeft,
  Refresh,
  Check,
  Code,
  Spark,
  Copy,
  Component as Layers,
  HandCard,
} from "iconoir-react";

export default function HelloWorldSandboxPage() {
  const [count, setCount] = useState(0);
  const [inputText, setInputText] = useState("Hello world");
  const [selectedVariant, setSelectedVariant] = useState<"default" | "subtle" | "glow">("default");
  const [copied, setCopied] = useState(false);

  const handleCopySnippet = () => {
    const snippet = `<div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm">
  <h2 className="text-lg font-semibold text-foreground">My component</h2>
  <p className="text-sm text-muted-foreground mt-1">Ready for testing.</p>
</div>`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCount(0);
    setInputText("Hello world");
    setSelectedVariant("default");
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased">
      {/* Background ambient light */}
      <div 
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-full max-w-4xl bg-primary/5 blur-3xl rounded-full" />
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Link
                href="/labs/sandbox"
                className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-[0.97]"
              >
                <NavArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                Back to sandbox
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                Template
              </span>
              <span className="text-muted-foreground/40">/</span>
              <Link
                href="/labs/sandbox/hello-world/basic"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                Barebones
              </Link>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Hello world
            </h1>
          </div>

        </header>

        {/* Main Testing Card */}
        <main className="space-y-6">
          <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6">
              {/* Card Title & Variant Controls */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="text-base font-semibold text-card-foreground">
                      Component preview
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click and type to check state updates and button transitions.
                  </p>
                </div>

                {/* Segmented Variant Switch */}
                <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs font-medium">
                  {(["default", "subtle", "glow"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelectedVariant(v)}
                      className={`rounded-md px-2.5 py-1 capitalize transition-all duration-150 ease-out active:scale-[0.97] ${
                        selectedVariant === v
                          ? "bg-card text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Preview Area */}
              <div
                className={`flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/80 p-8 sm:p-12 transition-all duration-200 ease-out ${
                  selectedVariant === "glow"
                    ? "bg-primary/5 border-primary/40 shadow-sm"
                    : selectedVariant === "subtle"
                    ? "bg-muted/30"
                    : "bg-background/80"
                }`}
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-150 ease-out hover:scale-105">
                  <Spark className="h-6 w-6" />
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {inputText.trim() ? inputText : "Hello, world"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Clicks:&nbsp;
                    <span className="inline-flex items-center justify-center rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                      {count}
                    </span>
                  </p>
                </div>

                {/* Button with active:scale-[0.97] */}
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setCount((prev) => prev + 1)}
                    className="group relative inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform duration-150 ease-out hover:opacity-95 active:scale-[0.97] cursor-pointer"
                  >
                    <HandCard className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
                    Increment count
                  </button>

                  <button
                    onClick={() => setCount(0)}
                    disabled={count === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground shadow-2xs transition-all duration-150 ease-out hover:border-border hover:text-foreground active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Input Sandbox Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="live-input"
                  className="block text-xs font-medium text-foreground"
                >
                  Message
                </label>
                <input
                  id="live-input"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type anything here..."
                  className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-2 text-sm text-foreground shadow-2xs placeholder:text-muted-foreground/60 transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </section>

          {/* Playground Dropzone for New Components */}
          <section className="rounded-2xl border border-border/50 bg-card/60 p-6">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm mb-1">
              <Layers className="h-4 w-4 text-primary" />
              <span>Test component slot</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Drop components inside this container to test layout and props.
            </p>

            <div className="rounded-xl border border-dashed border-border/80 bg-background/50 p-6 text-center">
              <div className="mx-auto max-w-sm space-y-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Code className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-foreground">
                  Render custom components here
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Edit <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground">src/app/labs/sandbox/hello-world/page.tsx</code> to add imports and JSX.
                </p>
              </div>
            </div>
          </section>

          {/* Notes */}
          <footer className="rounded-xl border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground">
            <h4 className="font-semibold text-foreground mb-1.5">Guidelines</h4>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>Use semantic tokens like <code className="text-foreground font-mono">bg-card</code> and <code className="text-foreground font-mono">border-border</code>. No raw hex codes.</li>
              <li>Add <code className="text-foreground font-mono">active:scale-[0.97] transition-transform duration-150 ease-out</code> to clickable elements for press feedback.</li>
              <li>Start enter transitions from <code className="text-foreground font-mono">scale(0.95)</code> and zero opacity. Never scale from 0.</li>
            </ul>
          </footer>
        </main>
      </div>
    </div>
  );
}
