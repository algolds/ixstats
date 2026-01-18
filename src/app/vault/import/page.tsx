"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { api } from "~/trpc/react";
import {
  Loader2,
  Download,
  CheckCircle,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Info,
  TrendingUp,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { VaultIcon } from "~/components/vault/VaultIcon";
import { CardIcon } from "~/components/vault/CardIcon";
import Link from "next/link";

type WizardStep = "intro" | "verify" | "preview" | "importing" | "complete";

interface ImportStats {
  totalImports: number;
  totalCards: number;
  totalValue: number;
  lastImport: Date | null;
}

export default function ImportPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("intro");
  const [nationName, setNationName] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [checksum, setChecksum] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [importResult, setImportResult] = useState<{
    cardsImported: number;
    bonusCredits: number;
    nation: string;
  } | null>(null);

  // Queries
  const { data: importStats } = api.nsImport.getImportStats.useQuery();
  const { data: importHistory } = api.nsImport.getMyImportHistory.useQuery({ limit: 5 });

  // Mutations
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
      setCurrentStep("preview");
      toast.error("Import failed");
    },
  });

  // Load preview when entering preview step
  useEffect(() => {
    if (currentStep === "preview" && nationName) {
      refetchPreview();
    }
  }, [currentStep, nationName, refetchPreview]);

  const handleStartImport = () => {
    if (!nationName.trim()) {
      setErrorMessage("Please enter your nation name");
      return;
    }
    setErrorMessage("");
    requestVerification.mutate({ nationName: nationName.trim() });
  };

  const handleVerify = () => {
    if (!checksum.trim()) {
      setErrorMessage("Please enter the verification code");
      return;
    }
    setErrorMessage("");
    checkVerification.mutate({ verificationId, checksum: checksum.trim() });
  };

  const handleConfirmImport = () => {
    setCurrentStep("importing");
    importDeck.mutate({ verificationId });
  };

  const resetWizard = () => {
    setCurrentStep("intro");
    setNationName("");
    setVerificationId("");
    setVerificationUrl("");
    setChecksum("");
    setErrorMessage("");
    setImportResult(null);
  };

  const getStepNumber = (step: WizardStep): number => {
    const steps: WizardStep[] = ["intro", "verify", "preview", "importing", "complete"];
    return steps.indexOf(step) + 1;
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600">
            <Download className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Import NationStates Deck</h1>
            <p className="text-muted-foreground">
              Securely connect your NationStates account to import your trading cards
            </p>
          </div>
        </div>
      </motion.div>

      {/* Progress Indicator */}
      {currentStep !== "intro" && currentStep !== "complete" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-hierarchy-child rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Step {getStepNumber(currentStep)} of 4
            </span>
            <span className="text-sm text-muted-foreground">
              {currentStep === "verify" && "Verify Nation"}
              {currentStep === "preview" && "Preview & Confirm"}
              {currentStep === "importing" && "Importing Cards"}
            </span>
          </div>
          <Progress
            value={(getStepNumber(currentStep) / 4) * 100}
            className="h-2"
          />
        </motion.div>
      )}

      {/* Error Alert */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Introduction */}
        {currentStep === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="glass-hierarchy-child border-purple-200 dark:border-purple-700/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Welcome to NS Card Import
                </CardTitle>
                <CardDescription>
                  Import your NationStates trading card collection into IxCards
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col items-center text-center p-4 rounded-lg bg-white/5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 text-white mb-2">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold mb-1">Secure Verification</h3>
                    <p className="text-sm text-muted-foreground">
                      Prove ownership using NS official API
                    </p>
                  </div>

                  <div className="flex flex-col items-center text-center p-4 rounded-lg bg-white/5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 text-white mb-2">
                      <Package className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold mb-1">Import Your Deck</h3>
                    <p className="text-sm text-muted-foreground">
                      All your cards imported automatically
                    </p>
                  </div>

                  <div className="flex flex-col items-center text-center p-4 rounded-lg bg-white/5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 text-white mb-2">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold mb-1">Earn IxCredits</h3>
                    <p className="text-sm text-muted-foreground">
                      Bonus credits for your first import
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <label htmlFor="nationName" className="text-sm font-medium">
                    Your Nation Name
                  </label>
                  <Input
                    id="nationName"
                    type="text"
                    placeholder="e.g., Testlandia"
                    value={nationName}
                    onChange={(e) => setNationName(e.target.value)}
                    className="glass-hierarchy-interactive"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleStartImport();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your nation name exactly as it appears on NationStates
                  </p>
                </div>

                <Button
                  onClick={handleStartImport}
                  disabled={requestVerification.isPending}
                  className="w-full"
                  size="lg"
                >
                  {requestVerification.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Import Stats */}
            {importStats && importStats.totalImports > 0 && (
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="text-lg">Your Import History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {importStats.totalImports}
                      </div>
                      <div className="text-xs text-muted-foreground">Nations Imported</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {importStats.totalCards}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Cards</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(importStats.totalValue)}
                      </div>
                      <div className="text-xs text-muted-foreground">IxC Value</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Step 2: Verify Nation */}
        {currentStep === "verify" && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-500" />
                  Verify Nation Ownership
                </CardTitle>
                <CardDescription>
                  Complete verification to prove you own <strong>{nationName}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <strong>How it works:</strong>
                    <ol className="mt-2 ml-4 list-decimal space-y-1 text-sm">
                      <li>Make sure you're logged into {nationName} on NationStates</li>
                      <li>Click the button below to open the verification page</li>
                      <li>Copy the verification code shown on that page</li>
                      <li>Paste it here and click "Verify & Continue"</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <Button
                  variant="outline"
                  asChild
                  className="w-full"
                  size="lg"
                >
                  <a
                    href={verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Verification Page
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>

                <div className="space-y-2">
                  <label htmlFor="checksum" className="text-sm font-medium">
                    Verification Code
                  </label>
                  <Input
                    id="checksum"
                    type="text"
                    placeholder="Paste the code from NationStates here"
                    value={checksum}
                    onChange={(e) => setChecksum(e.target.value)}
                    disabled={checkVerification.isPending}
                    className="glass-hierarchy-interactive font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleVerify();
                      }
                    }}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => setCurrentStep("intro")}
                    variant="outline"
                    className="flex-1"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleVerify}
                    disabled={checkVerification.isPending}
                    className="flex-1"
                    size="lg"
                  >
                    {checkVerification.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify & Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Preview & Confirm */}
        {currentStep === "preview" && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-500" />
                  Preview Your Deck
                </CardTitle>
                <CardDescription>
                  Review your deck before importing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {deckPreview ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="rounded-lg border p-4 text-center">
                        <div className="text-3xl font-bold text-purple-600">
                          {deckPreview.uniqueCards}
                        </div>
                        <div className="text-sm text-muted-foreground">Unique Cards</div>
                      </div>
                      <div className="rounded-lg border p-4 text-center">
                        <div className="text-3xl font-bold text-purple-600">
                          {deckPreview.totalCards}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Cards</div>
                      </div>
                      <div className="rounded-lg border p-4 text-center">
                        <div className="text-3xl font-bold text-purple-600">
                          {deckPreview.deckValue.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">NS Bank Value</div>
                      </div>
                      <div className="rounded-lg border p-4 text-center">
                        <div className="text-3xl font-bold text-green-600">
                          +{deckPreview.estimatedIxCredits}
                        </div>
                        <div className="text-sm text-muted-foreground">Bonus IxC</div>
                      </div>
                    </div>

                    {deckPreview.rarityBreakdown && Object.keys(deckPreview.rarityBreakdown).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Rarity Breakdown:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(deckPreview.rarityBreakdown).map(([rarity, count]) => (
                            <div
                              key={rarity}
                              className="flex items-center justify-between rounded-lg border p-2"
                            >
                              <Badge variant="outline" className="capitalize">
                                {rarity}
                              </Badge>
                              <span className="font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Ready to import! Your cards will be added to your IxCards vault.
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setCurrentStep("verify")}
                    variant="outline"
                    className="flex-1"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={!deckPreview}
                    className="flex-1"
                    size="lg"
                  >
                    Confirm & Import
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Importing */}
        {currentStep === "importing" && (
          <motion.div
            key="importing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <Card className="glass-hierarchy-child">
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="relative">
                    <Loader2 className="h-16 w-16 animate-spin text-purple-500" />
                    <motion.div
                      className="absolute inset-0 rounded-full border-4 border-purple-200"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">Importing Your Deck...</h3>
                    <p className="text-muted-foreground">
                      This may take a minute. Please don't close this page.
                    </p>
                  </div>

                  <div className="w-full max-w-md">
                    <Progress value={undefined} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 5: Complete */}
        {currentStep === "complete" && importResult && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <Card className="glass-hierarchy-child border-green-200 dark:border-green-700/40">
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center space-y-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500"
                  >
                    <CheckCircle className="h-10 w-10 text-white" />
                  </motion.div>

                  <div className="space-y-2">
                    <h3 className="text-3xl font-bold">Import Complete!</h3>
                    <p className="text-muted-foreground">
                      Successfully imported your {importResult.nation} deck
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                    <div className="rounded-lg border-2 border-purple-200 dark:border-purple-700/40 p-4">
                      <div className="text-3xl font-bold text-purple-600">
                        {importResult.cardsImported}
                      </div>
                      <div className="text-sm text-muted-foreground">Cards Imported</div>
                    </div>
                    <div className="rounded-lg border-2 border-green-200 dark:border-green-700/40 p-4">
                      <div className="text-3xl font-bold text-green-600">
                        +{importResult.bonusCredits}
                      </div>
                      <div className="text-sm text-muted-foreground">Bonus IxC</div>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full max-w-md">
                    <Button
                      onClick={resetWizard}
                      variant="outline"
                      className="flex-1"
                    >
                      Import Another
                    </Button>
                    <Button asChild className="flex-1">
                      <Link href="/vault/inventory">View My Cards</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Confetti Animation */}
            <motion.div
              className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: 3, duration: 1 }}
            >
              {Array.from({ length: 50 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: [
                      "#a855f7",
                      "#6366f1",
                      "#ec4899",
                      "#f59e0b",
                      "#10b981",
                    ][i % 5],
                  }}
                  initial={{
                    x: 0,
                    y: 0,
                    scale: 0,
                  }}
                  animate={{
                    x: (Math.random() - 0.5) * 1000,
                    y: Math.random() * 1000,
                    scale: Math.random() * 2,
                    opacity: 0,
                  }}
                  transition={{
                    duration: 2 + Math.random(),
                    ease: "easeOut",
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security & How It Works Cards */}
      {currentStep === "intro" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-2 gap-6"
        >
          <Card className="glass-hierarchy-child border-green-200 dark:border-green-700/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <ShieldCheck className="h-5 w-5" />
                Secure Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <strong>Why verify?</strong> To prevent unauthorized access to other players' decks,
                you must prove you own the nation using NationStates' official verification system.
              </p>
              <p className="text-muted-foreground">
                We use NationStates' built-in verification API. No sensitive information is shared -
                just a simple one-time verification code.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                  1
                </Badge>
                <div className="flex-1">
                  <p className="font-medium">Enter Nation Name</p>
                  <p className="text-sm text-muted-foreground">
                    Provide your NationStates nation name
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                  2
                </Badge>
                <div className="flex-1">
                  <p className="font-medium">Verify Ownership</p>
                  <p className="text-sm text-muted-foreground">
                    Get verification code from NS while logged in
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                  3
                </Badge>
                <div className="flex-1">
                  <p className="font-medium">Import & Enjoy</p>
                  <p className="text-sm text-muted-foreground">
                    Your deck imports automatically with bonus IxC
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Import History Table */}
      {currentStep === "intro" && importHistory && importHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle>Recent Imports</CardTitle>
              <CardDescription>Your latest NationStates deck imports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {importHistory.map((imp) => (
                  <div
                    key={imp.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
                        <Package className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium">{imp.nationName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(imp.importedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{imp.cardsImported} cards</p>
                      <p className="text-sm text-green-600">+{imp.bonusCredits} IxC</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
