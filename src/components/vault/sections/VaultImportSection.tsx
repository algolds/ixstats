"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { PageHeader } from "~/components/shell/PageHeader";
import { Card, CardContent } from "~/components/ui/card";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { proxyNSImage } from "~/lib/cards/ns-image-proxy";
import { ImportStepIndicator, type WizardStep } from "./import/ImportStepIndicator";
import { ImportNationStep } from "./import/ImportNationStep";
import { ImportVerifyStep } from "./import/ImportVerifyStep";
import {
  ImportConfirmStep,
  ImportCompleteStep,
  type ImportResult,
} from "./import/ImportConfirmStep";

interface VaultImportSectionProps {
  initialTab?: string | null;
}

function ImportDeckTab() {
  const notify = useNotify();
  const utils = api.useUtils();
  const refreshCards = useCardsRefresh();
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
        faces: data.faces,
      });
      setCurrentStep("complete");
      vaultNotify.cardsImported(data.cardsImported, data.nation);
      // So Mine, the display, Explore and the Settings NS panel list the new copies
      refreshCards();
      void utils.nsImport.getMyNSCards.invalidate();
    },
    onError: (error) => {
      setErrorMessage(error.message);
      vaultNotify.error(error.message);
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Import cards"
        subtitle="Verify a NationStates nation and bring its deck into your Vault."
        back={{ href: "/vault", label: "Vault" }}
        bleed
      />

      {/* Wizard container */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="relative flex flex-col gap-6 overflow-hidden py-6">
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
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
              backgroundColor: "rgb(234, 234, 226)",
              backgroundImage: `url(${proxyNSImage(
                "https://www.nationstates.net/images/globegreenslim2.jpg"
              )})`,
              backgroundPosition: "100% 0%",
              backgroundRepeat: "no-repeat",
              paddingLeft: "15px",
            }}
            className="border-separator border-b"
          >
            <img
              src={proxyNSImage("https://www.nationstates.net/images/bannertitle.png")}
              alt="NationStates logo"
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
                  <Signal
                    tone="destructive"
                    title="Verification or import failed"
                    onDismiss={() => setErrorMessage("")}
                  >
                    {errorMessage}
                  </Signal>
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
                  <div
                    aria-busy
                    className="flex flex-col items-center justify-center space-y-6 py-10"
                  >
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="rounded-card aspect-[5/7] w-20 sm:w-24" />
                      ))}
                    </div>

                    <div className="space-y-1.5 text-center">
                      <p className="text-label text-title-2">Importing cards</p>
                      <p className="text-label-secondary text-body max-w-xs">
                        Fetching your deck from NationStates and minting a card for each copy.
                      </p>
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
