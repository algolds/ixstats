"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  Globe,
  Search,
  Filter,
  TrendingUp,
  Layers,
  Award,
  Trophy,
  MapPin,
  Tag,
  ChevronDown,
  X,
  AlertCircle,
  Star,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Info,
  Package,
  Copy,
  Check,
  Clock,
  Coins,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import NumberFlow from "~/components/ui/number-flow";
import type { CardInstance } from "~/types/cards-display";
import type { CardRarity } from "@prisma/client";

type SubTab = "import" | "ns-library";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Download }[] = [
  { id: "import", label: "Import Deck", icon: Download },
  { id: "ns-library", label: "NS Library", icon: Globe },
];

interface VaultImportSectionProps {
  initialTab?: string | null;
}

// ─── Import Deck Tab ─────────────────────────────────────────────

type WizardStep = "intro" | "verify" | "preview" | "importing" | "complete";

const WIZARD_STEPS: { id: WizardStep; label: string; icon: typeof Globe }[] = [
  { id: "intro", label: "Nation", icon: Globe },
  { id: "verify", label: "Verify", icon: ShieldCheck },
  { id: "preview", label: "Confirm", icon: CheckCircle },
  { id: "importing", label: "Import", icon: Download },
  { id: "complete", label: "Done", icon: Sparkles },
];

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIdx = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-between gap-1 px-2">
      {WIZARD_STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isComplete = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={step.id} className="flex flex-1 items-center gap-0">
            {/* Step circle */}
            <motion.div
              className={cn(
                "relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                isComplete && "border-green-400 bg-green-500/20",
                isCurrent && "border-rose-400 bg-rose-500/20",
                !isComplete && !isCurrent && "border-white/10 bg-white/5"
              )}
              animate={isCurrent ? { scale: [1, 1.08, 1] } : {}}
              transition={isCurrent ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
            >
              {isComplete ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Icon className={cn("h-4 w-4", isCurrent ? "text-rose-400" : "text-muted-foreground/50")} />
              )}
            </motion.div>

            {/* Label (hidden on mobile for space) */}
            <span className={cn(
              "ml-1.5 hidden text-xs font-semibold sm:inline",
              isComplete && "text-green-400",
              isCurrent && "text-rose-400",
              !isComplete && !isCurrent && "text-muted-foreground/50"
            )}>
              {step.label}
            </span>

            {/* Connecting line */}
            {idx < WIZARD_STEPS.length - 1 && (
              <div className="mx-2 h-px flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-green-400 to-rose-400"
                  initial={{ width: "0%" }}
                  animate={{ width: isComplete ? "100%" : isCurrent ? "50%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImportDeckTab() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("intro");
  const [nationName, setNationName] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [importResult, setImportResult] = useState<{
    cardsImported: number;
    bonusCredits: number;
    nation: string;
  } | null>(null);

  const { data: importStats } = api.nsImport.getImportStats.useQuery();
  const { data: importHistory } = api.nsImport.getMyImportHistory.useQuery({ limit: 5 });

  const requestVerification = api.nsImport.requestVerification.useMutation({
    onSuccess: (data) => {
      setVerificationId(data.verificationId);
      setVerificationUrl(data.verificationUrl);
      setCurrentStep("verify");
      toast.success("Verification request created");
    },
    onError: (error) => {
      setErrorMessage(error.message);
      toast.error("Failed to request verification");
    },
  });

  const checkVerification = api.nsImport.checkVerification.useMutation({
    onSuccess: (data) => {
      if (data.verified) {
        setCurrentStep("preview");
        toast.success("Nation verified!");
      } else {
        setErrorMessage("Verification failed. Please check your code and try again.");
        toast.error("Verification failed");
      }
    },
    onError: (error) => {
      setErrorMessage(error.message);
      toast.error("Verification error");
    },
  });

  const { data: deckPreview, refetch: refetchPreview } = api.nsImport.previewDeck.useQuery(
    { nationName },
    { enabled: false }
  );

  const importDeck = api.nsImport.importDeck.useMutation({
    onSuccess: (data) => {
      setImportResult({
        cardsImported: data.cardsImported,
        bonusCredits: data.bonusCredits,
        nation: data.nation,
      });
      setCurrentStep("complete");
      toast.success(`Imported ${data.cardsImported} cards!`);
    },
    onError: (error) => {
      setErrorMessage(error.message);
      toast.error("Import failed");
    },
  });

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(verificationId);
    setCodeCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCodeCopied(false), 2000);
  }, [verificationId]);

  return (
    <div className="space-y-6">
      {/* Stats header — only visible for returning importers or during/after an active import */}
      <AnimatePresence>
        {importStats && (importStats.totalImports > 0 || currentStep === "importing" || currentStep === "complete") && (
          <motion.div
            className="grid gap-3 grid-cols-2 sm:grid-cols-4"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
          >
            {[
              { label: "Total Imports", value: importStats.totalImports, icon: Download, color: "rose", gradient: "from-rose-500/20 to-orange-500/20", border: "border-rose-400/30" },
              { label: "Cards Imported", value: importStats.totalCards, icon: Layers, color: "amber", gradient: "from-amber-500/20 to-yellow-500/20", border: "border-amber-400/30" },
              { label: "Total Value", value: `${importStats.totalValue.toLocaleString()}`, icon: Coins, color: "green", gradient: "from-green-500/20 to-emerald-500/20", border: "border-green-400/30" },
              { label: "Last Import", value: importStats.lastImport ? new Date(importStats.lastImport).toLocaleDateString() : "Never", icon: Clock, color: "cyan", gradient: "from-cyan-500/20 to-blue-500/20", border: "border-cyan-400/30" },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                <Card className={cn("glass-hierarchy-child overflow-hidden border", stat.border)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("rounded-lg bg-gradient-to-br p-2.5", stat.gradient)}>
                        <stat.icon className={cn("h-4 w-4", `text-${stat.color}-400`)} />
                      </div>
                      <div className="min-w-0">
                        <p className={cn("text-lg font-black truncate", `text-${stat.color}-400`)}>
                          {typeof stat.value === "number" ? <NumberFlow value={stat.value} /> : stat.value}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wizard container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-hierarchy-parent relative overflow-hidden border border-white/10">
          {/* Subtle gradient accent along the top */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />

          <CardContent className="p-5 sm:p-8 space-y-8">
            {/* Step indicator */}
            <StepIndicator currentStep={currentStep} />

            {/* Error display */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Alert variant="destructive" className="border-red-500/30 bg-red-500/5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                    <button onClick={() => setErrorMessage("")} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step content with transitions */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* ── Step: Intro ─────────────────────────── */}
                {currentStep === "intro" && (
                  <div className="space-y-6">
                    {/* Hero visual */}
                    <div className="flex flex-col items-center text-center py-4">
                      <div className="relative mb-5">
                        <motion.div
                          className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-500/20 to-orange-500/20 blur-2xl"
                          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-rose-400/30 bg-gradient-to-br from-rose-500/10 to-orange-500/10 backdrop-blur-sm">
                          <Globe className="h-12 w-12 text-rose-400" />
                        </div>
                      </div>
                      <h2 className="text-2xl font-black text-foreground sm:text-3xl">Import Your NS Deck</h2>
                      <p className="mt-2 max-w-md text-sm text-muted-foreground">
                        Bring your NationStates trading cards into IxCards. Verify nation ownership and import in minutes.
                      </p>
                    </div>

                    {/* How it works cards */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { step: "1", title: "Enter Nation", desc: "Type your NationStates nation name", icon: Globe, color: "rose" },
                        { step: "2", title: "Add Code", desc: "Place a verification code in your nation's description", icon: ShieldCheck, color: "amber" },
                        { step: "3", title: "Verify", desc: "We confirm you own the nation", icon: CheckCircle, color: "green" },
                        { step: "4", title: "Import", desc: "Your NS trading cards are imported", icon: Download, color: "purple" },
                      ].map((item) => (
                        <div
                          key={item.step}
                          className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4"
                        >
                          <div className={cn(
                            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-black text-white",
                            item.color === "rose" && "from-rose-500 to-rose-600",
                            item.color === "amber" && "from-amber-500 to-amber-600",
                            item.color === "green" && "from-green-500 to-green-600",
                            item.color === "purple" && "from-purple-500 to-purple-600",
                          )}>
                            {item.step}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Nation name input */}
                    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
                      <label className="text-sm font-semibold text-foreground">Your Nation Name</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={nationName}
                          onChange={(e) => setNationName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && nationName.trim()) {
                              setErrorMessage("");
                              requestVerification.mutate({ nationName });
                            }
                          }}
                          placeholder="e.g. Testlandia"
                          className="h-12 pl-10 text-base glass-hierarchy-interactive"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          setErrorMessage("");
                          requestVerification.mutate({ nationName });
                        }}
                        disabled={!nationName.trim() || requestVerification.isPending}
                        className="w-full h-11 bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold hover:from-rose-600 hover:to-orange-600 shadow-lg shadow-rose-500/20"
                        size="lg"
                      >
                        {requestVerification.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="mr-2 h-4 w-4" />
                        )}
                        Start Verification
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Step: Verify ────────────────────────── */}
                {currentStep === "verify" && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-xl font-black text-foreground">Verify Ownership</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Prove you own <span className="font-semibold text-rose-400">{nationName}</span> by adding this code to your nation
                      </p>
                    </div>

                    {/* Verification code card */}
                    <div className="overflow-hidden rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
                      <div className="flex items-center justify-between border-b border-amber-400/10 px-5 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/70">Verification Code</span>
                        <button
                          onClick={handleCopyCode}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/10"
                        >
                          {codeCopied ? (
                            <><Check className="h-3.5 w-3.5" /> Copied</>
                          ) : (
                            <><Copy className="h-3.5 w-3.5" /> Copy</>
                          )}
                        </button>
                      </div>
                      <div className="px-5 py-4">
                        <code className="block break-all rounded-lg bg-black/30 px-4 py-3 font-mono text-sm leading-relaxed text-amber-300 selection:bg-amber-400/30">
                          {verificationId}
                        </code>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-5">
                      <h4 className="text-sm font-bold text-foreground">Instructions</h4>
                      <ol className="list-inside space-y-2.5 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">1</span>
                          Copy the verification code above
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">2</span>
                          <span>
                            Go to{" "}
                            {verificationUrl ? (
                              <a href={verificationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-400 hover:underline">
                                your nation's settings <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              "your nation's settings on NationStates"
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">3</span>
                          Paste the code into your nation's description field and save
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">4</span>
                          Click "Check Verification" below
                        </li>
                      </ol>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setCurrentStep("intro")} className="border-white/10">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        onClick={() => {
                          setErrorMessage("");
                          checkVerification.mutate({ verificationId, nationName });
                        }}
                        disabled={checkVerification.isPending}
                        className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold hover:from-rose-600 hover:to-orange-600 shadow-lg shadow-rose-500/20"
                      >
                        {checkVerification.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        Check Verification
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Step: Preview / Confirm ─────────────── */}
                {currentStep === "preview" && (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center text-center py-2">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 ring-2 ring-green-400/30"
                      >
                        <CheckCircle className="h-8 w-8 text-green-400" />
                      </motion.div>
                      <h2 className="text-2xl font-black text-foreground">Nation Verified</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-green-400">{nationName}</span> is confirmed as yours
                      </p>
                    </div>

                    <div className="rounded-xl border border-green-400/20 bg-green-500/5 p-5">
                      <div className="flex items-start gap-3">
                        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                        <div className="text-sm text-muted-foreground">
                          <p className="mb-1 font-semibold text-foreground">Ready to import</p>
                          <p>This will fetch your NationStates trading card deck and create IxCards versions. The process takes a few seconds depending on deck size. You can remove the verification code from your nation's description after importing.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setCurrentStep("verify")} className="border-white/10">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        onClick={() => {
                          setErrorMessage("");
                          setCurrentStep("importing");
                          importDeck.mutate({ nationName, verificationId });
                        }}
                        className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold hover:from-rose-600 hover:to-orange-600 shadow-lg shadow-rose-500/20"
                        size="lg"
                      >
                        <Download className="mr-2 h-4 w-4" /> Import Deck
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Step: Importing ─────────────────────── */}
                {currentStep === "importing" && (
                  <div className="flex flex-col items-center justify-center py-14 space-y-6">
                    {/* Animated card stack */}
                    <div className="relative">
                      <motion.div
                        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-500/15 to-orange-500/15 blur-3xl"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div className="relative flex h-28 w-28 items-center justify-center">
                        {/* Orbiting cards */}
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="absolute h-14 w-10 rounded-lg border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm"
                            animate={{
                              rotate: [0 + i * 120, 360 + i * 120],
                              x: [0, 20, 0, -20, 0],
                              y: [0, -10, 0, 10, 0],
                            }}
                            transition={{
                              rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                              x: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 },
                              y: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 },
                            }}
                            style={{ originX: 0.5, originY: 0.5 }}
                          />
                        ))}
                        <Loader2 className="relative h-10 w-10 animate-spin text-rose-400" />
                      </div>
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-xl font-black text-foreground">Importing Cards...</p>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Fetching your deck from NationStates and creating IxCards. This may take a moment.
                      </p>
                    </div>

                    <div className="w-full max-w-xs">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          style={{ width: "50%" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Step: Complete ──────────────────────── */}
                {currentStep === "complete" && importResult && (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center text-center py-4">
                      {/* Celebration burst */}
                      <div className="relative mb-6">
                        <motion.div
                          className="absolute inset-0 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 blur-3xl"
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 2, 1.5], opacity: [0, 0.8, 0.4] }}
                          transition={{ duration: 0.8 }}
                        />
                        {/* Sparkle particles */}
                        {[...Array(6)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute h-1.5 w-1.5 rounded-full bg-amber-400"
                            initial={{ x: 0, y: 0, opacity: 0 }}
                            animate={{
                              x: Math.cos((i / 6) * Math.PI * 2) * 50,
                              y: Math.sin((i / 6) * Math.PI * 2) * 50,
                              opacity: [0, 1, 0],
                              scale: [0, 1.5, 0],
                            }}
                            transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                            style={{ left: "50%", top: "50%" }}
                          />
                        ))}
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 ring-2 ring-green-400/30"
                        >
                          <CheckCircle className="h-10 w-10 text-green-400" />
                        </motion.div>
                      </div>

                      <motion.h2
                        className="text-3xl font-black text-foreground"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        Import Complete!
                      </motion.h2>
                      <motion.p
                        className="mt-1 text-sm text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        Your deck from <span className="font-semibold text-green-400">{importResult.nation}</span> has been imported
                      </motion.p>
                    </div>

                    {/* Result stat cards */}
                    <motion.div
                      className="grid grid-cols-2 gap-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <div className="rounded-xl border border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-5 text-center">
                        <Package className="mx-auto mb-2 h-6 w-6 text-purple-400" />
                        <p className="text-3xl font-black text-purple-400">
                          <NumberFlow value={importResult.cardsImported} />
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground">Cards Imported</p>
                      </div>
                      <div className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-5 text-center">
                        <Coins className="mx-auto mb-2 h-6 w-6 text-amber-400" />
                        <p className="text-3xl font-black text-amber-400">
                          +<NumberFlow value={importResult.bonusCredits} />
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground">Bonus IxCredits</p>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                    >
                      <Button
                        onClick={() => { setCurrentStep("intro"); setNationName(""); setImportResult(null); setErrorMessage(""); }}
                        variant="outline"
                        className="w-full border-white/10"
                      >
                        <ArrowRight className="mr-2 h-4 w-4" /> Import Another Nation
                      </Button>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Import History */}
      {importHistory && importHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-hierarchy-child border border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Imports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {importHistory.map((entry: any, idx: number) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10">
                        <Globe className="h-4 w-4 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{entry.nationName}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(entry.importedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-purple-400/30 text-purple-400">
                      {entry.cardsImported} cards
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

// ─── NS Library Tab ──────────────────────────────────────────────

interface NSLibraryFilters {
  search: string;
  season: number | "all";
  rarity: CardRarity | "all";
  region: string;
  sortBy: "rarity" | "marketValue" | "recent" | "name";
}

const PAGE_SIZE = 50;

function NSLibraryTab() {
  const [filters, setFilters] = useState<NSLibraryFilters>({
    search: "",
    season: "all",
    rarity: "all",
    region: "",
    sortBy: "rarity",
  });
  const [offset, setOffset] = useState(0);
  const [allCards, setAllCards] = useState<any[]>([]);

  const queryInput = useMemo(() => ({
    limit: PAGE_SIZE,
    offset,
    search: filters.search || undefined,
    season: filters.season !== "all" ? filters.season : undefined,
    rarity: filters.rarity !== "all" ? filters.rarity : undefined,
    region: filters.region || undefined,
    sortBy: filters.sortBy,
  }), [filters, offset]);

  const { data: nsCardsData, isLoading, isFetching } = api.cards.getNSCards.useQuery(queryInput);
  const { data: libraryStats } = api.cards.getNSLibraryStats.useQuery();

  // Accumulate cards for "Load More" pagination
  const displayCards = useMemo(() => {
    if (!nsCardsData) return allCards;
    if (offset === 0) return nsCardsData.cards;
    // Append new page to accumulated cards
    const existingIds = new Set(allCards.map((c: any) => c.id));
    const newCards = nsCardsData.cards.filter((c: any) => !existingIds.has(c.id));
    return [...allCards, ...newCards];
  }, [nsCardsData, offset, allCards]);

  // Sync display cards into allCards state when data changes
  useEffect(() => {
    if (nsCardsData) {
      if (offset === 0) {
        setAllCards(nsCardsData.cards);
      } else {
        setAllCards(prev => {
          const existingIds = new Set(prev.map((c: any) => c.id));
          const newCards = nsCardsData.cards.filter((c: any) => !existingIds.has(c.id));
          return [...prev, ...newCards];
        });
      }
    }
  }, [nsCardsData, offset]);

  // Reset pagination when filters change
  const handleFilterChange = useCallback((update: Partial<NSLibraryFilters>) => {
    setOffset(0);
    setAllCards([]);
    setFilters(prev => ({ ...prev, ...update }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Library stats banner */}
      {libraryStats && libraryStats.totalCards > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-purple-400/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-bold text-purple-400">
              <NumberFlow value={libraryStats.totalCards} />
            </span>
            <span className="text-xs text-muted-foreground">cards in library</span>
          </div>
          {libraryStats.cardsByRegion.length > 0 && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Top: <span className="font-semibold text-foreground/80">{libraryStats.cardsByRegion[0]?.region}</span>
                {" "}({libraryStats.cardsByRegion[0]?.count.toLocaleString()})
              </span>
            </div>
          )}
          {libraryStats.lastSync && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Last sync: {new Date(libraryStats.lastSync.at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <Card className="glass-hierarchy-child">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
                placeholder="Search by nation name..."
                className="pl-10 glass-hierarchy-interactive"
              />
            </div>
            <Select value={filters.season.toString()} onValueChange={(v) => handleFilterChange({ season: v === "all" ? "all" : parseInt(v) })}>
              <SelectTrigger className="w-[140px] glass-hierarchy-interactive">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent className="glass-hierarchy-modal">
                <SelectItem value="all">All Seasons</SelectItem>
                <SelectItem value="1">Season 1</SelectItem>
                <SelectItem value="2">Season 2</SelectItem>
                <SelectItem value="3">Season 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.rarity} onValueChange={(v) => handleFilterChange({ rarity: v as CardRarity | "all" })}>
              <SelectTrigger className="w-[160px] glass-hierarchy-interactive">
                <SelectValue placeholder="Rarity" />
              </SelectTrigger>
              <SelectContent className="glass-hierarchy-modal">
                <SelectItem value="all">All Rarities</SelectItem>
                <SelectItem value="COMMON">Common</SelectItem>
                <SelectItem value="UNCOMMON">Uncommon</SelectItem>
                <SelectItem value="RARE">Rare</SelectItem>
                <SelectItem value="ULTRA_RARE">Ultra Rare</SelectItem>
                <SelectItem value="EPIC">Epic</SelectItem>
                <SelectItem value="LEGENDARY">Legendary</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.sortBy} onValueChange={(v) => handleFilterChange({ sortBy: v as NSLibraryFilters["sortBy"] })}>
              <SelectTrigger className="w-[160px] glass-hierarchy-interactive">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="glass-hierarchy-modal">
                <SelectItem value="rarity">Rarity</SelectItem>
                <SelectItem value="marketValue">Market Value</SelectItem>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Region filter row */}
          <div className="mt-3 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={filters.region}
                onChange={(e) => handleFilterChange({ region: e.target.value })}
                placeholder="Filter by region..."
                className="h-9 pl-9 text-xs glass-hierarchy-interactive"
              />
            </div>
            {(filters.search || filters.rarity !== "all" || filters.season !== "all" || filters.region) && (
              <button
                onClick={() => handleFilterChange({ search: "", season: "all", rarity: "all", region: "", sortBy: "rarity" })}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards grid */}
      {isLoading && offset === 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : displayCards.length === 0 ? (
        <Card className="glass-hierarchy-child">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Globe className="mb-4 h-16 w-16 text-muted-foreground/40" />
            <p className="text-xl font-bold text-foreground/80 mb-2">No NS Cards Found</p>
            <p className="text-muted-foreground text-center max-w-md">
              {filters.search || filters.rarity !== "all" || filters.season !== "all" || filters.region
                ? "Try adjusting your filters"
                : "No NS cards have been imported yet. Use the admin panel to fetch region cards or import a season dump."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {displayCards.map((card: any) => (
              <CardDisplay key={card.id} card={card} size="medium" />
            ))}
          </div>

          {/* Load More + count */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {displayCards.length} of {nsCardsData?.total.toLocaleString() ?? "..."} cards
            </p>
            {nsCardsData?.hasMore && (
              <Button
                variant="outline"
                onClick={() => setOffset(prev => prev + PAGE_SIZE)}
                disabled={isFetching}
                className="border-white/10"
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="mr-2 h-4 w-4" />
                )}
                Load More
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────

function resolveInitialTab(initialTab: string | null | undefined): SubTab {
  if (initialTab === "ns-library") return "ns-library";
  return "import";
}

export function VaultImportSection({ initialTab }: VaultImportSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>(() => resolveInitialTab(initialTab));

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-black/20 p-1 backdrop-blur-sm">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-all",
                isActive
                  ? "bg-rose-500/20 text-rose-400 shadow-sm"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "import" && <ImportDeckTab />}
          {activeTab === "ns-library" && <NSLibraryTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
