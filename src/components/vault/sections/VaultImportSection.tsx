"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { vaultNotify } from "~/lib/vault";
import { Card, CardContent } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { proxyNSImage } from "~/lib/cards";
import { ImportStepIndicator, type WizardStep } from "./import/ImportStepIndicator";
import { ImportNationStep } from "./import/ImportNationStep";
import { ImportVerifyStep } from "./import/ImportVerifyStep";
import { ImportConfirmStep, ImportCompleteStep, type ImportResult } from "./import/ImportConfirmStep";

interface VaultImportSectionProps {
  initialTab?: string | null;
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
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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

  const importDeck = api.nsImport.importDeck.useMutation({
    onSuccess: (data) => {
      setImportResult({
        cardsImported: data.cardsImported,
        bonusCredits: data.bonusCredits,
        nation: data.nation,
        cards: (data.cards ?? []).map((c: any) => ({
          id: c.id,
          title: c.title ?? "Unknown Card",
          artwork: c.artwork ?? "/images/cards/placeholder-nation.png",
          rarity: c.rarity ?? "COMMON",
          season: c.season ?? 1,
          marketValue: c.marketValue ?? 0,
        })),
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
              backgroundImage: `url(${proxyNSImage(
                "https://www.nationstates.net/images/globegreenslim2.jpg"
              )})`,
              backgroundPosition: "100% 0%",
              backgroundRepeat: "no-repeat",
              paddingLeft: "15px",
            }}
            className="border-b border-white/10"
          >
            <img
              src={proxyNSImage("https://www.nationstates.net/images/bannertitle.png")}
              alt="NationStates Logo"
              className="h-9 w-auto object-contain"
            />
          </div>

          <CardContent className="space-y-8 p-5 sm:p-8">
            {/* Step indicator */}
            <ImportStepIndicator currentStep={currentStep} />

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
                {currentStep === "intro" && (
                  <ImportNationStep
                    nationName={nationName}
                    setNationName={setNationName}
                    showNameInput={showNameInput}
                    setShowNameInput={setShowNameInput}
                    onRequestVerification={(name) => {
                      setErrorMessage("");
                      requestVerification.mutate({ nationName: name });
                    }}
                    isPending={requestVerification.isPending}
                  />
                )}

                {currentStep === "verify" && (
                  <ImportVerifyStep
                    nationName={nationName}
                    verificationUrl={verificationUrl}
                    checksum={checksum}
                    setChecksum={setChecksum}
                    onVerify={() => {
                      setErrorMessage("");
                      checkVerification.mutate({ verificationId, checksum });
                    }}
                    onBack={() => setCurrentStep("intro")}
                    isPending={checkVerification.isPending}
                  />
                )}

                {currentStep === "preview" && (
                  <ImportConfirmStep
                    nationName={nationName}
                    onBack={() => setCurrentStep("verify")}
                    onConfirmImport={() => {
                      setErrorMessage("");
                      setCurrentStep("importing");
                      importDeck.mutate({ verificationId });
                    }}
                  />
                )}

                {currentStep === "importing" && (
                  <div className="flex flex-col items-center justify-center space-y-6 py-14">
                    <div className="relative">
                      <motion.div
                        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-500/15 to-orange-500/15 blur-3xl"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div className="relative flex h-28 w-28 items-center justify-center">
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

                {currentStep === "complete" && importResult && (
                  <ImportCompleteStep
                    importResult={importResult}
                    onReset={() => {
                      setCurrentStep("intro");
                      setNationName("");
                      setShowNameInput(false);
                      setChecksum("");
                      setImportResult(null);
                      setErrorMessage("");
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export function VaultImportSection({ initialTab: _initialTab }: VaultImportSectionProps) {
  return <ImportDeckTab />;
}
