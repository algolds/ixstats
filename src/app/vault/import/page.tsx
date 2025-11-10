"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { Loader2, Download, CheckCircle, XCircle, ExternalLink, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type ImportStep = "idle" | "verifying_nation" | "pending_verification" | "checking" | "importing" | "success" | "error";

export default function ImportPage() {
  const [nationName, setNationName] = useState("");
  const [step, setStep] = useState<ImportStep>("idle");
  const [verificationId, setVerificationId] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [checksum, setChecksum] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [importedCards, setImportedCards] = useState(0);

  const requestVerification = api.nsImport.requestVerification.useMutation({
    onSuccess: (data) => {
      setVerificationId(data.verificationId);
      setVerificationUrl(data.verificationUrl);
      setStep("pending_verification");
    },
    onError: (error) => {
      setStep("error");
      setErrorMessage(error.message);
    },
  });

  const checkVerification = api.nsImport.checkVerification.useMutation({
    onSuccess: (data) => {
      if (data.verified) {
        setStep("importing");
        importDeck.mutate({ verificationId });
      } else {
        setStep("error");
        setErrorMessage("Verification failed. The code may be incorrect, expired, or your nation may not be logged in.");
      }
    },
    onError: (error) => {
      setStep("error");
      setErrorMessage(error.message);
    },
  });

  const importDeck = api.nsImport.importDeck.useMutation({
    onSuccess: (data) => {
      setStep("success");
      setImportedCards(data.cardsImported);
      toast.success(`Successfully imported ${data.cardsImported} cards! +${data.bonusCredits} IxCredits bonus!`);
    },
    onError: (error) => {
      setStep("error");
      setErrorMessage(error.message);
    },
  });

  const handleRequestVerification = async () => {
    if (!nationName.trim()) {
      setErrorMessage("Please enter your nation name");
      return;
    }

    setStep("verifying_nation");
    setErrorMessage("");
    requestVerification.mutate({ nationName: nationName.trim() });
  };

  const handleCheckVerification = () => {
    if (!checksum.trim()) {
      setErrorMessage("Please enter the verification code from NationStates");
      return;
    }

    setStep("checking");
    setErrorMessage("");
    checkVerification.mutate({ verificationId, checksum: checksum.trim() });
  };

  const resetForm = () => {
    setStep("idle");
    setNationName("");
    setVerificationId("");
    setVerificationUrl("");
    setChecksum("");
    setErrorMessage("");
    setImportedCards(0);
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Import NationStates Deck</h1>
        <p className="text-muted-foreground">
          Securely connect your NationStates account to import your trading card deck
        </p>
      </div>

      {/* Import Card */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {step === "pending_verification" ? "Verify Nation Ownership" : "Import Your Deck"}
          </CardTitle>
          <CardDescription>
            {step === "pending_verification"
              ? "Complete verification to prove you own this nation"
              : "Enter your NationStates nation name to begin"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Messages */}
          {step === "success" && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Successfully imported {importedCards} cards from your NationStates deck!
              </AlertDescription>
            </Alert>
          )}

          {step === "error" && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Enter Nation Name */}
          {(step === "idle" || step === "verifying_nation" || step === "error") && !verificationId && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="nationName" className="text-sm font-medium">
                  Nation Name
                </label>
                <Input
                  id="nationName"
                  type="text"
                  placeholder="e.g., Testlandia"
                  value={nationName}
                  onChange={(e) => setNationName(e.target.value)}
                  disabled={step === "verifying_nation"}
                  className="glass-hierarchy-interactive"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRequestVerification();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your nation name exactly as it appears on NationStates
                </p>
              </div>

              <Button
                onClick={handleRequestVerification}
                disabled={step === "verifying_nation"}
                className="w-full"
                size="lg"
              >
                {step === "verifying_nation" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying Nation...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Request Verification
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Pending Verification */}
          {step === "pending_verification" && verificationUrl && (
            <div className="space-y-4">
              <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong>Verification Required</strong>
                  <p className="mt-2">To prove you own this nation, visit the link below while logged into NationStates.</p>
                </AlertDescription>
              </Alert>

              <div className="space-y-2 rounded-lg border p-4">
                <h4 className="font-medium">Instructions:</h4>
                <ol className="ml-4 list-decimal space-y-2 text-sm">
                  <li>Make sure you're logged into <strong>{nationName}</strong> on NationStates</li>
                  <li>Click the button below to open the verification page</li>
                  <li>Copy the verification code shown on that page</li>
                  <li>Paste it into the field below and click "Verify & Import"</li>
                </ol>
              </div>

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
                  disabled={step === "checking" || step === "importing"}
                  className="glass-hierarchy-interactive font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCheckVerification();
                    }
                  }}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleCheckVerification}
                  disabled={step === "checking" || step === "importing"}
                  className="flex-1"
                  size="lg"
                >
                  {step === "checking" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : step === "importing" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing Cards...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Verify & Import
                    </>
                  )}
                </Button>
              </div>

              <Button
                onClick={resetForm}
                variant="ghost"
                className="w-full"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Success Actions */}
          {step === "success" && (
            <div className="flex gap-3">
              <Button onClick={resetForm} variant="outline" className="flex-1">
                Import Another
              </Button>
              <Button asChild className="flex-1">
                <a href="/vault/inventory">View My Cards</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="glass-hierarchy-child border-green-200 dark:border-green-700/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <ShieldCheck className="h-5 w-5" />
            Secure Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>Why do we verify?</strong> To prevent unauthorized access to other players' decks,
            you must prove you own the nation using NationStates' official verification system.
          </p>
          <p className="text-muted-foreground">
            We use NationStates' built-in verification API to confirm you're logged into the nation.
            No sensitive information is shared - just a simple one-time verification code.
          </p>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                1
              </Badge>
              <div>
                <p className="font-medium">Request Verification</p>
                <p className="text-sm text-muted-foreground">
                  Enter your nation name and receive a unique verification code
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                2
              </Badge>
              <div>
                <p className="font-medium">Get Verification Code</p>
                <p className="text-sm text-muted-foreground">
                  Visit the NationStates verification page while logged in to get your unique code
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                3
              </Badge>
              <div>
                <p className="font-medium">Verify & Import</p>
                <p className="text-sm text-muted-foreground">
                  Paste the code and your deck will be automatically imported to IxCards
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
