// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  Download,
  Globe,
  Sparkles,
  Loader2,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Info,
  Package,
  Check,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Clock,
  Coins,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Layers,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { vaultNotify } from "~/lib/vault-notifications";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Alert, AlertDescription } from "~/components/ui/alert";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Badge } from "~/components/ui/badge";
import NumberFlow from "~/components/ui/number-flow";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";

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
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
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
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isCurrent ? "text-rose-400" : "text-muted-foreground/50"
                  )}
                />
              )}
            </motion.div>

            {/* Label (hidden on mobile for space) */}
            <span
              className={cn(
                "ml-1.5 hidden text-xs font-semibold sm:inline",
                isComplete && "text-green-400",
                isCurrent && "text-rose-400",
                !isComplete && !isCurrent && "text-muted-foreground/50"
              )}
            >
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
  const notify = useNotify();
  const [currentStep, setCurrentStep] = useState<WizardStep>("intro");
  const [nationName, setNationName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [checksum, setChecksum] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [importResult, setImportResult] = useState<{
    cardsImported: number;
    bonusCredits: number;
    nation: string;
    cards: {
      id: string;
      title: string;
      artwork: string;
      rarity: string;
      season: number;
      marketValue: number;
    }[];
  } | null>(null);

  const { data: importStats } = api.nsImport.getImportStats.useQuery();

  const requestVerification = api.nsImport.requestVerification.useMutation({
    onSuccess: (data) => {
      setVerificationId(data.verificationId);
      setVerificationUrl(data.verificationUrl);
      setCurrentStep("verify");
      notify.success("Verification request created");
    },
    onError: (error) => {
      setErrorMessage(error.message);
      vaultNotify.error("Failed to request verification");
    },
  });

  const checkVerification = api.nsImport.checkVerification.useMutation({
    onSuccess: (data) => {
      if (data.verified) {
        setCurrentStep("preview");
        vaultNotify.nationVerified(nationName);
      } else {
        setErrorMessage("Verification failed. Please check your code and try again.");
        vaultNotify.error("Verification failed");
      }
    },
    onError: (error) => {
      setErrorMessage(error.message);
      vaultNotify.error("Verification error");
    },
  });

  const { refetch: _refetchPreview } = api.nsImport.previewDeck.useQuery(
    { nationName },
    { enabled: false }
  );

  const importDeck = api.nsImport.importDeck.useMutation({
    onSuccess: (data) => {
      setImportResult({
        cardsImported: data.cardsImported,
        bonusCredits: data.bonusCredits,
        nation: data.nation,
        cards: data.cards ?? [],
      });
      setCurrentStep("complete");
      vaultNotify.cardsImported(data.cardsImported, data.nation);
    },
    onError: (error) => {
      setErrorMessage(error.message);
      vaultNotify.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      {/* Wizard container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-hierarchy-parent relative overflow-hidden border border-white/10">
          {/* NS Header Banner */}
          <div
            style={{
              margin: 0,
              padding: 0,
              width: "100%",
              height: "60px",
              whiteSpace: "nowrap",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              position: "relative",
              boxShadow: "0 1px 2px #666",
              backgroundColor: "#EAEAE2",
              backgroundImage: "url(https://www.nationstates.net/images/globegreenslim2.jpg)",
              backgroundPosition: "100% 0%",
              backgroundRepeat: "no-repeat",
              paddingLeft: "15px",
            }}
            className="border-b border-white/10"
          >
            <img
              src="https://www.nationstates.net/images/bannertitle.png"
              alt="NationStates Logo"
              className="h-9 w-auto object-contain"
            />
          </div>

          <CardContent className="space-y-8 p-5 sm:p-8">
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
                    <button
                      onClick={() => setErrorMessage("")}
                      className="text-muted-foreground hover:text-foreground absolute top-3 right-3"
                    >
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
                    {/* Hero visual / Header */}
                    <div className="flex flex-col items-center py-4 text-center">
                      <div className="mb-2.5 flex items-center justify-center gap-2.5">
                        <h2 className="text-foreground text-3xl font-black tracking-tight select-none sm:text-4xl">
                          Trading Cards
                        </h2>
                        {/* Custom 3-cards icon next to title */}
                        <div className="relative h-7 w-10 shrink-0 select-none">
                          {/* Card 1 (Back left) */}
                          <div className="absolute top-0.5 left-0 h-6.5 w-4 -rotate-12 rounded-[4px] border-2 border-slate-900 bg-white shadow-sm dark:border-white dark:bg-slate-950" />
                          {/* Card 2 (Middle) */}
                          <div className="absolute top-0 left-3 flex h-6.5 w-4 items-center justify-center rounded-[4px] border-2 border-slate-900 bg-white shadow-sm dark:border-white dark:bg-slate-950">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-900 dark:bg-white" />
                          </div>
                          {/* Card 3 (Right) */}
                          <div className="absolute top-0.5 left-6 flex h-6.5 w-4 rotate-12 items-center justify-center rounded-[4px] border-2 border-slate-900 bg-white shadow-sm dark:border-white dark:bg-slate-950">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-900 dark:bg-white" />
                          </div>
                        </div>
                      </div>
                      <p className="text-muted-foreground max-w-md text-sm">
                        Bring your NationStates trading cards into IxCards. Verify nation ownership
                        and import in minutes.
                      </p>
                    </div>

                    {/* How it works cards */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          step: "1",
                          title: "Enter Nation",
                          desc: "Type your NationStates nation name",
                          icon: Globe,
                          color: "rose",
                        },
                        {
                          step: "2",
                          title: "Visit NS Link",
                          desc: "Open a NationStates verification page",
                          icon: ExternalLink,
                          color: "amber",
                        },
                        {
                          step: "3",
                          title: "Paste Code",
                          desc: "Copy the code NS gives you and paste it here",
                          icon: ShieldCheck,
                          color: "green",
                        },
                        {
                          step: "4",
                          title: "Import",
                          desc: "Your NS trading cards are imported",
                          icon: Download,
                          color: "purple",
                        },
                      ].map((item) => (
                        <div
                          key={item.step}
                          className="glass-hierarchy-child border-border flex items-start gap-3 rounded-xl border p-4"
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-black text-white",
                              item.color === "rose" && "from-rose-500 to-rose-600",
                              item.color === "amber" && "from-amber-500 to-amber-600",
                              item.color === "green" && "from-green-500 to-green-600",
                              item.color === "purple" && "from-purple-500 to-purple-600"
                            )}
                          >
                            {item.step}
                          </div>
                          <div>
                            <p className="text-foreground text-sm font-bold">{item.title}</p>
                            <p className="text-muted-foreground text-xs">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Safety Disclaimer */}
                    <div className="glass-hierarchy-child border-border/50 text-muted-foreground flex items-start gap-2.5 rounded-xl border bg-white/5 p-4 text-xs select-none">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                      <div className="space-y-0.5">
                        <p className="text-foreground font-bold">Important</p>
                        <p className="leading-relaxed">
                          Verification uses the official{" "}
                          <a
                            href="https://www.nationstates.net/page=api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-500"
                          >
                            NationStates API
                          </a>{" "}
                          and only grants read-only access to verify public deck contents. We will
                          never ask for your NationStates password or account credentials.
                        </p>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {!showNameInput ? (
                        <motion.div
                          key="start-btn"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Button
                            onClick={() => setShowNameInput(true)}
                            className="h-12 w-full bg-gradient-to-r from-rose-500 to-orange-500 text-base font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-600"
                            size="lg"
                          >
                            <Sparkles className="mr-2 h-5 w-5" />
                            Get Started
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="name-input"
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -15 }}
                          transition={{ duration: 0.2 }}
                          className="glass-hierarchy-child border-border space-y-3 rounded-xl border p-5"
                        >
                          <div className="flex items-center justify-between">
                            <label className="text-foreground text-sm font-semibold">
                              Your Nation Name
                            </label>
                            <button
                              onClick={() => {
                                setNationName("");
                                setShowNameInput(false);
                              }}
                              className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                          <div className="relative">
                            <Globe className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
                              className="glass-hierarchy-interactive h-12 pl-10 text-base"
                              autoFocus
                            />
                          </div>
                          <Button
                            onClick={() => {
                              setErrorMessage("");
                              requestVerification.mutate({ nationName });
                            }}
                            disabled={!nationName.trim() || requestVerification.isPending}
                            className="h-11 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-600"
                            size="lg"
                          >
                            {requestVerification.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="mr-2 h-4 w-4" />
                            )}
                            Start Verification
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ── Step: Verify ────────────────────────── */}
                {currentStep === "verify" && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-foreground text-xl font-black">Verify Ownership</h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Prove you own{" "}
                        <span className="font-semibold text-rose-400">{nationName}</span> via
                        NationStates login verification
                      </p>
                    </div>

                    {/* Instructions */}
                    <div className="glass-hierarchy-child border-border space-y-3 rounded-xl border p-5">
                      <h4 className="text-foreground text-sm font-bold">Instructions</h4>
                      <ol className="text-muted-foreground list-inside space-y-2.5 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                            1
                          </span>
                          <span>
                            Click the link below to open NationStates verification.{" "}
                            <strong className="text-foreground/80">Log in if prompted.</strong>
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                            2
                          </span>
                          NationStates will display a verification code
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                            3
                          </span>
                          Copy that code and paste it in the field below
                        </li>
                      </ol>
                    </div>

                    {/* NS verification link */}
                    {verificationUrl && (
                      <a
                        href={verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-5 py-3.5 text-sm font-bold text-blue-400 transition-colors hover:bg-blue-500/20"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open NationStates Verification Page
                      </a>
                    )}

                    {/* Code input */}
                    <div className="space-y-2 rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-5">
                      <label className="text-xs font-semibold tracking-wider text-amber-400/70 uppercase">
                        Paste Verification Code from NationStates
                      </label>
                      <Input
                        value={checksum}
                        onChange={(e) => setChecksum(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && checksum.trim()) {
                            setErrorMessage("");
                            checkVerification.mutate({ verificationId, checksum });
                          }
                        }}
                        placeholder="Paste the code NationStates gave you..."
                        className="glass-hierarchy-interactive h-12 font-mono text-base"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep("intro")}
                        className="border-white/10"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        onClick={() => {
                          setErrorMessage("");
                          checkVerification.mutate({ verificationId, checksum });
                        }}
                        disabled={!checksum.trim() || checkVerification.isPending}
                        className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-600"
                      >
                        {checkVerification.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        Verify Ownership
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Step: Preview / Confirm ─────────────── */}
                {currentStep === "preview" && (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center py-2 text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 ring-2 ring-green-400/30"
                      >
                        <CheckCircle className="h-8 w-8 text-green-400" />
                      </motion.div>
                      <h2 className="text-foreground text-2xl font-black">Nation Verified</h2>
                      <p className="text-muted-foreground mt-2 text-sm">
                        <span className="font-semibold text-green-400">{nationName}</span> is
                        confirmed as yours
                      </p>
                    </div>

                    <div className="rounded-xl border border-green-400/20 bg-green-500/5 p-5">
                      <div className="flex items-start gap-3">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                        <div className="text-muted-foreground text-sm">
                          <p className="text-foreground mb-1 font-semibold">Ready to import</p>
                          <p>
                            This will fetch your NationStates trading card deck and create IxCards
                            versions. The process takes a few seconds depending on deck size.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep("verify")}
                        className="border-white/10"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        onClick={() => {
                          setErrorMessage("");
                          setCurrentStep("importing");
                          importDeck.mutate({ nationName, verificationId });
                        }}
                        className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-600"
                        size="lg"
                      >
                        <Download className="mr-2 h-4 w-4" /> Import Deck
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Step: Importing ─────────────────────── */}
                {currentStep === "importing" && (
                  <div className="flex flex-col items-center justify-center space-y-6 py-14">
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
                              x: {
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.3,
                              },
                              y: {
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.3,
                              },
                            }}
                            style={{ originX: 0.5, originY: 0.5 }}
                          />
                        ))}
                        <Loader2 className="relative h-10 w-10 animate-spin text-rose-400" />
                      </div>
                    </div>

                    <div className="space-y-2 text-center">
                      <p className="text-foreground text-xl font-black">Importing Cards...</p>
                      <p className="text-muted-foreground max-w-xs text-sm">
                        Fetching your deck from NationStates and creating IxCards. This may take a
                        moment.
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
                    <div className="flex flex-col items-center py-4 text-center">
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
                        className="text-foreground text-3xl font-black"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        Import Complete!
                      </motion.h2>
                      <motion.p
                        className="text-muted-foreground mt-1 text-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        Your deck from{" "}
                        <span className="font-semibold text-green-400">{importResult.nation}</span>{" "}
                        has been imported
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
                        <p className="text-muted-foreground text-xs font-semibold">
                          Cards Imported
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-5 text-center">
                        <Coins className="mx-auto mb-2 h-6 w-6 text-amber-400" />
                        <p className="text-3xl font-black text-amber-400">
                          +<NumberFlow value={importResult.bonusCredits} />
                        </p>
                        <p className="text-muted-foreground text-xs font-semibold">
                          Bonus IxCredits
                        </p>
                      </div>
                    </motion.div>

                    {/* Imported cards preview */}
                    {importResult.cards.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                        className="space-y-2"
                      >
                        <p className="text-muted-foreground text-xs font-semibold">Your Cards</p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                          {importResult.cards.slice(0, 12).map((card, idx) => (
                            <motion.div
                              key={card.id}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.6 + idx * 0.05 }}
                              className={cn(
                                "relative overflow-hidden rounded-lg border bg-gradient-to-b p-1.5",
                                card.rarity === "LEGENDARY" &&
                                  "border-amber-400/40 from-amber-500/10 to-amber-600/5",
                                card.rarity === "EPIC" &&
                                  "border-purple-400/40 from-purple-500/10 to-purple-600/5",
                                card.rarity === "ULTRA_RARE" &&
                                  "border-red-400/40 from-red-500/10 to-red-600/5",
                                card.rarity === "RARE" &&
                                  "border-blue-400/40 from-blue-500/10 to-blue-600/5",
                                card.rarity === "UNCOMMON" &&
                                  "border-green-400/40 from-green-500/10 to-green-600/5",
                                (!card.rarity || card.rarity === "COMMON") &&
                                  "border-white/10 from-white/5 to-white/[0.02]"
                              )}
                            >
                              <div className="relative mx-auto mb-1 h-10 w-10 overflow-hidden rounded">
                                <CardHolographicCover
                                  cardType="NS_IMPORT"
                                  rarity={card.rarity || "COMMON"}
                                  title={card.title}
                                />
                                {card.artwork &&
                                  card.artwork !== "/images/cards/placeholder-nation.png" && (
                                    <img
                                      src={card.artwork}
                                      alt={card.title}
                                      className="absolute inset-0 h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  )}
                              </div>
                              <p className="truncate text-center text-[9px] leading-tight font-bold">
                                {card.title}
                              </p>
                              <p className="text-muted-foreground text-center text-[8px]">
                                S{card.season} ·{" "}
                                {card.marketValue > 0
                                  ? `${card.marketValue.toFixed(2)} MV`
                                  : (card.rarity?.toLowerCase() ?? "common")}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                        {importResult.cards.length > 12 && (
                          <p className="text-muted-foreground text-center text-[10px]">
                            +{importResult.cards.length - 12} more cards
                          </p>
                        )}
                      </motion.div>
                    )}

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                    >
                      <Button
                        onClick={() => {
                          setCurrentStep("intro");
                          setNationName("");
                          setShowNameInput(false);
                          setChecksum("");
                          setImportResult(null);
                          setErrorMessage("");
                        }}
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
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────

export function VaultImportSection({ initialTab: _initialTab }: VaultImportSectionProps) {
  return <ImportDeckTab />;
}
