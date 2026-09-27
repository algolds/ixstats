"use client";

import { ArrowLeft, ArrowRight, Check, Xmark } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  WIZARD_STEP_COUNT,
  WizardStepBasics,
  WizardStepNarrative,
  WizardStepParticipant,
  WizardStepReview,
  WizardStepSettings,
  useExchangeWizardForm,
  type ExchangeWizardData,
  type WizardHostCountry,
} from "./exchange-wizard";

interface CulturalExchangeWizardProps {
  hostCountry: WizardHostCountry;
  onComplete: (data: ExchangeWizardData) => void;
  onCancel: () => void;
}

const STEPS = [1, 2, 3, 4, 5];

export function CulturalExchangeWizard({
  hostCountry,
  onComplete,
  onCancel,
}: CulturalExchangeWizardProps) {
  const form = useExchangeWizardForm(hostCountry);
  const { currentStep, data } = form;

  // Step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <WizardStepBasics
            title={data.title}
            onTitleChange={form.setTitle}
            type={form.type}
            onTypeChange={form.setType}
            description={data.description}
            onDescriptionChange={form.setDescription}
            showMoreTypes={form.showMoreTypes}
            onShowMoreTypesChange={form.setShowMoreTypes}
          />
        );
      case 2:
        return (
          <WizardStepParticipant
            countrySearch={form.countrySearch}
            onCountrySearchChange={form.setCountrySearch}
            isLoading={form.isLoadingCountries}
            countries={form.availableCountries}
            participantCountryId={data.participantCountryId}
            onSelect={form.setParticipantCountryId}
          />
        );
      case 3:
        return (
          <WizardStepNarrative
            narrative={data.narrative}
            onNarrativeChange={form.setNarrative}
            narrativePlaceholder={form.narrativePlaceholder}
            objectives={data.objectives}
            onToggleObjective={form.toggleObjective}
          />
        );
      case 4:
        return (
          <WizardStepSettings
            startDate={data.startDate}
            onStartDateChange={form.setStartDate}
            endDate={data.endDate}
            onEndDateChange={form.setEndDate}
            currentIxTimeDate={form.currentIxTimeDate}
            maxParticipants={data.maxParticipants}
            onMaxParticipantsChange={form.setMaxParticipants}
            isPublic={data.isPublic}
            onIsPublicChange={form.setIsPublic}
          />
        );
      case 5:
        return (
          <WizardStepReview
            data={data}
            type={form.type}
            hostCountry={hostCountry}
            selectedCountry={form.selectedCountry}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden rounded-lg">
      {/* Header */}
      <div className="border-border bg-muted/30 flex shrink-0 items-center justify-between border-b p-4">
        <div>
          <h2 className="text-foreground text-xl font-bold">Create Cultural Exchange</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Step {currentStep} of {WIZARD_STEP_COUNT}
          </p>
        </div>
        <button onClick={onCancel} className="hover:bg-accent rounded-lg p-2 transition-colors">
          <Xmark className="text-foreground h-5 w-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="shrink-0 px-4 py-3">
        <div className="flex gap-2">
          {STEPS.map((step) => (
            <div
              key={step}
              className={cn(
                "h-2 flex-1 rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300",
                step <= currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="pb-12">{renderStepContent()}</div>
      </div>

      {/* Footer */}
      <div className="border-border bg-muted/30 flex shrink-0 justify-between gap-4 border-t p-4">
        <Button variant="outline" onClick={currentStep === 1 ? onCancel : form.handlePrevious}>
          <ArrowLeft className="mr-2" />
          {currentStep === 1 ? "Cancel" : "Previous"}
        </Button>

        {currentStep < WIZARD_STEP_COUNT ? (
          <Button onClick={form.handleNext} disabled={form.isNextDisabled}>
            Next
            <ArrowRight className="ml-2" />
          </Button>
        ) : (
          <Button onClick={() => onComplete(data)}>
            <Check className="mr-2" />
            Create Exchange
          </Button>
        )}
      </div>
    </div>
  );
}
