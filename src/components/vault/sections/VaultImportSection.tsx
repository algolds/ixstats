"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { useNotify } from "~/hooks/useNotify";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { REDUCED_MOTION_FADE, springSmooth } from "~/lib/design/motion";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { PageHeader } from "~/components/shell/PageHeader";
import { Card } from "~/components/ui/card";
import { Signal } from "~/components/ui/signal";
import { Skeleton } from "~/components/ui/skeleton";
import { StepIndicator } from "~/components/ui/step-indicator";
import { NationStatesAttribution } from "~/components/cards/display/NationStatesAttribution";
import type { WizardStep } from "./import/ImportStepIndicator";
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

interface ImportWizardState {
  currentStep: WizardStep;
  nationName: string;
  verificationId: string;
  verificationUrl: string;
  checksum: string;
  errorMessage: string;
  importResult: ImportResult | null;
}

const INITIAL_WIZARD_STATE: ImportWizardState = {
  currentStep: "intro",
  nationName: "",
  verificationId: "",
  verificationUrl: "",
  checksum: "",
  errorMessage: "",
  importResult: null,
};

const FLOW_STEPS = [
  { id: "intro", label: "Nation" },
  { id: "verify", label: "Verify" },
  { id: "preview", label: "Confirm" },
  { id: "import", label: "Import" },
] as const;

function resolveStepIndex(step: WizardStep): number {
  switch (step) {
    case "intro":
      return 0;
    case "verify":
      return 1;
    case "preview":
      return 2;
    case "importing":
      return 3;
    case "complete":
      return FLOW_STEPS.length;
  }
}

function ImportDeckTab() {
  const notify = useNotify();
  const utils = api.useUtils();
  const refreshCards = useCardsRefresh();
  const reduce = useFacetReducedMotion();
  const [wizard, setWizard] = useState<ImportWizardState>(INITIAL_WIZARD_STATE);

  const {
    currentStep,
    nationName,
    verificationId,
    verificationUrl,
    checksum,
    errorMessage,
    importResult,
  } = wizard;

  const requestVerification = api.nsImport.requestVerification.useMutation({
    onSuccess: (data) => {
      setWizard((prev) => ({
        ...prev,
        verificationId: data.verificationId,
        verificationUrl: data.verificationUrl,
        currentStep: "verify",
      }));
      notify.success("Verification request created");
    },
    onError: (error) => {
      setWizard((prev) => ({ ...prev, errorMessage: error.message }));
      vaultNotify.error("Failed to request verification");
    },
  });

  const checkVerification = api.nsImport.checkVerification.useMutation({
    onSuccess: (data) => {
      if (data.verified) {
        setWizard((prev) => ({ ...prev, currentStep: "preview" }));
        vaultNotify.nationVerified(nationName);
      } else {
        setWizard((prev) => ({
          ...prev,
          errorMessage: "Verification failed. Please check your code and try again.",
        }));
        vaultNotify.error("Verification failed");
      }
    },
    onError: (error) => {
      setWizard((prev) => ({ ...prev, errorMessage: error.message }));
      vaultNotify.error("Verification error");
    },
  });

  const importDeck = api.nsImport.importDeck.useMutation({
    onSuccess: (data) => {
      setWizard((prev) => ({
        ...prev,
        importResult: {
          cardsImported: data.cardsImported,
          bonusCredits: data.bonusCredits,
          nation: data.nation,
          faces: data.faces,
        },
        currentStep: "complete",
      }));
      vaultNotify.cardsImported(data.cardsImported, data.nation);
      refreshCards();
      void utils.nsImport.getMyNSCards.invalidate();
    },
    onError: (error) => {
      setWizard((prev) => ({ ...prev, currentStep: "preview", errorMessage: error.message }));
      vaultNotify.error(error.message);
    },
  });

  const stepTransition = reduce ? REDUCED_MOTION_FADE : springSmooth;
  const canStepBack = currentStep === "verify" || currentStep === "preview";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
      <PageHeader
        title="Import deck"
        subtitle="Transfer NationStates trading cards into your Vault collection."
        bleed
      />

      <AnimatePresence initial={false}>
        {errorMessage && (
          <motion.div
            key="import-error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={REDUCED_MOTION_FADE}
          >
            <Signal
              tone="destructive"
              title="Verification or import failed"
              onDismiss={() => setWizard((prev) => ({ ...prev, errorMessage: "" }))}
            >
              {errorMessage}
            </Signal>
          </motion.div>
        )}
      </AnimatePresence>

      <Card variant="pane" padding="lg" content="input" className="space-y-6">
        <div className="border-separator border-b pb-4">
          <StepIndicator
            aria-label="Import deck steps"
            steps={FLOW_STEPS}
            current={resolveStepIndex(currentStep)}
            compactOnPhones={false}
            onStepClick={
              canStepBack
                ? (index) => {
                    const target: WizardStep = index === 0 ? "intro" : "verify";
                    setWizard((prev) => ({ ...prev, currentStep: target, errorMessage: "" }));
                  }
                : undefined
            }
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={stepTransition}
          >
            {currentStep === "intro" && (
              <ImportNationStep
                nationName={nationName}
                setNationName={(name) => setWizard((prev) => ({ ...prev, nationName: name }))}
                onRequestVerification={(name) => {
                  setWizard((prev) => ({ ...prev, nationName: name, errorMessage: "" }));
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
                setChecksum={(value) => setWizard((prev) => ({ ...prev, checksum: value }))}
                onVerify={() => {
                  setWizard((prev) => ({ ...prev, errorMessage: "" }));
                  checkVerification.mutate({ verificationId, checksum });
                }}
                onBack={() => setWizard((prev) => ({ ...prev, currentStep: "intro" }))}
                isPending={checkVerification.isPending}
              />
            )}

            {currentStep === "preview" && (
              <ImportConfirmStep
                nationName={nationName}
                onBack={() => setWizard((prev) => ({ ...prev, currentStep: "verify" }))}
                onConfirmImport={() => {
                  setWizard((prev) => ({
                    ...prev,
                    errorMessage: "",
                    currentStep: "importing",
                  }));
                  importDeck.mutate({ verificationId });
                }}
              />
            )}

            {currentStep === "importing" && (
              <div
                aria-busy
                className="flex flex-col items-center justify-center space-y-6 py-10 text-center"
              >
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="rounded-row aspect-[5/7] w-20 sm:w-24" />
                  ))}
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-label text-title-3">Importing cards</h2>
                  <p className="text-label-secondary text-body max-w-xs">
                    Fetching your deck from NationStates and minting a card for each copy.
                  </p>
                </div>
              </div>
            )}

            {currentStep === "complete" && importResult && (
              <ImportCompleteStep
                importResult={importResult}
                onReset={() => setWizard(INITIAL_WIZARD_STATE)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </Card>

      <NationStatesAttribution />
    </div>
  );
}

export function VaultImportSection({ initialTab: _initialTab }: VaultImportSectionProps) {
  return <ImportDeckTab />;
}
