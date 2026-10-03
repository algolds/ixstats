"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import { Button } from "~/components/ui/button";
import { StepIndicator } from "~/components/ui/step-indicator";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  Trash as Trash2,
  Plus,
  Send,
  Calendar,
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  Sparks as Sparkles,
  InfoCircle as Info,
  CheckCircle,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";

interface PollComposerProps {
  onSuccess?: () => void;
}

export function PollComposer({ onSuccess }: PollComposerProps) {
  const notify = useNotify();
  // Wizard Step State
  const [step, setStep] = useState(1);

  // Form States
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [pollType, setPollType] = useState<"choice" | "feature-poll" | "feature-voting">("choice");
  const [multiple, setMultiple] = useState(false);
  const [endDateStr, setEndDateStr] = useState("");
  const [targetScope, setTargetScope] = useState<"global" | "country">("global");
  const [countryId, setCountryId] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

  const { data: countriesData } = api.countries.getSelectList.useQuery({
    limit: 250,
    realm: ALL_REALMS,
  });

  const createMutation = api.polls.create.useMutation({
    onSuccess: () => {
      notify.success("Poll created and broadcasted successfully!");
      if (onSuccess) onSuccess();
      // Reset form
      setQuestion("");
      setDescription("");
      setPollType("choice");
      setMultiple(false);
      setEndDateStr("");
      setTargetScope("global");
      setCountryId("");
      setOptions(["", ""]);
      setStep(1);
    },
    onError: (err) => {
      notify.error(err.message || "Failed to create poll");
    },
  });

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const nextStep = () => {
    if (step === 1 && !question.trim()) {
      notify.error("Please enter a question or topic");
      return;
    }
    if (step === 2 && targetScope === "country" && !countryId) {
      notify.error("Please select a target country");
      return;
    }
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) {
      notify.error("Please enter a question");
      return;
    }

    const filteredOptions = options.map((opt) => opt.trim()).filter((opt) => opt.length > 0);
    if (filteredOptions.length < 2) {
      notify.error("At least 2 options are required");
      return;
    }

    const payload: {
      question: string;
      description?: string;
      pollType: "choice" | "feature-poll" | "feature-voting";
      multiple: boolean;
      endDate?: Date;
      countryId?: string;
      options: string[];
    } = {
      question,
      description: description || undefined,
      pollType,
      multiple,
      options: filteredOptions,
    };

    if (endDateStr) {
      payload.endDate = new Date(endDateStr);
    }

    if (targetScope === "country" && countryId) {
      payload.countryId = countryId;
    }

    createMutation.mutate(payload);
  };

  // Progress Indicators
  const STEPS = [
    { number: 1, label: "Topic & Context" },
    { number: 2, label: "Scope & Targeting" },
    { number: 3, label: "Options & Publish" },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="relative flex flex-col gap-6 overflow-hidden py-6">
          <CardHeader className="border-separator border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-label text-headline flex items-center gap-2">
                <Sparkles className="text-poll h-4 w-4" />
                Poll Wizard Composer
              </CardTitle>
              <span className="text-label-secondary text-caption">Step {step} of 3</span>
            </div>

            {/* Wizard progress */}
            <StepIndicator
              aria-label="Poll wizard progress"
              className="mt-4"
              steps={STEPS.map((st) => ({ id: String(st.number), label: st.label }))}
              current={step - 1}
            />
          </CardHeader>

          <CardContent className="p-6">
            <form
              onSubmit={handleSubmit}
              className="flex min-h-[300px] flex-col justify-between space-y-6"
            >
              {/* Step 1 Content */}
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-3 duration-fast space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="question" className="text-label text-caption">
                      Poll Question / Topic *
                    </Label>
                    <Input
                      id="question"
                      placeholder="e.g., What should be our priority for the next national budget?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}

                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-label text-caption">
                      Description / Context (optional)
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Provide additional details or context to help citizens make an informed choice..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}

                      rows={5}
                    />
                  </div>
                </div>
              )}

              {/* Step 2 Content */}
              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-3 duration-fast space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-label text-caption">Poll Type</Label>
                      <Select
                        value={pollType}
                        onValueChange={(val: "choice" | "feature-poll" | "feature-voting") => {
                          setPollType(val);
                          if (val === "feature-voting") {
                            setMultiple(true);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="choice">Standard Choice Poll</SelectItem>
                          <SelectItem value="feature-poll">Feature Priority Poll</SelectItem>
                          <SelectItem value="feature-voting">Feature Upvoting Board</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-label text-caption">Scope & Targeting</Label>
                      <Select
                        value={targetScope}
                        onValueChange={(val: "global" | "country") => setTargetScope(val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">Global (All Users)</SelectItem>
                          <SelectItem value="country">Country Targeted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {targetScope === "country" && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-fast space-y-2">
                      <Label className="text-label text-caption">Target Country *</Label>
                      <Select value={countryId} onValueChange={setCountryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country to restrict voting to" />
                        </SelectTrigger>
                        <SelectContent>
                          {countriesData?.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="endDate"
                        className="text-label text-caption flex items-center gap-2"
                      >
                        <Calendar className="text-label-secondary h-4 w-4" />
                        Expiry Date (optional)
                      </Label>
                      <Input
                        id="endDate"
                        type="datetime-local"
                        value={endDateStr}
                        onChange={(e) => setEndDateStr(e.target.value)}
                      />
                    </div>

                    {pollType !== "feature-voting" && (
                      <div className="flex items-center gap-2 pt-6">
                        <Switch id="multiple" checked={multiple} onCheckedChange={setMultiple} />
                        <Label
                          htmlFor="multiple"
                          className="text-label text-caption cursor-pointer"
                        >
                          Allow Multiple Option Choices
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3 Content */}
              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-3 duration-fast space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-label text-caption">List Poll Options *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddOption}
                      className="cursor-pointer gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Option
                    </Button>
                  </div>

                  <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                    {options.map((option, idx) => (
                      <div
                        key={idx}
                        className="animate-in fade-in duration-fast flex items-center gap-2"
                      >
                        <span className="text-label-secondary text-caption w-6 text-center">
                          {idx + 1}.
                        </span>
                        <Input
                          placeholder={`Option label ${idx + 1}`}
                          value={option}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          className="rounded-control-sm md:text-footnote h-(--control-height-sm) flex-1"
                          required
                        />
                        {options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(idx)}
                            className="text-destructive w-8 shrink-0 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-poll/20 bg-poll/5 text-poll rounded-control text-footnote mt-4 flex items-start gap-2 border p-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Review all parameters. Clicking <strong>Create & Publish</strong> will record
                      the poll and publish an announcement card directly to the active feeds.
                    </span>
                  </div>
                </div>
              )}

              {/* Navigation Actions */}
              <div className="border-separator mt-6 flex justify-between gap-3 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={step === 1}
                  className="cursor-pointer gap-2"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>

                {step < 3 ? (
                  <Button type="button" onClick={nextStep} className="cursor-pointer gap-2">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="cursor-pointer gap-2"
                  >
                    {createMutation.isPending ? (
                      "Creating..."
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Create & Publish
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Guide Card */}
      <div className="space-y-4">
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="text-label text-headline flex items-center gap-2">
              🗳️ Poll Creation Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="text-label-secondary text-footnote space-y-4 leading-relaxed">
            <div>
              <h5 className="text-label mb-1 flex items-center gap-2 font-semibold">
                <CheckCircle className="text-green h-3.5 w-3.5" /> Standard Choice Poll
              </h5>
              <p>
                Classic single or multiple choice query. Displays vote bar charts and raw counts to
                citizens.
              </p>
            </div>

            <div>
              <h5 className="text-label mb-1 flex items-center gap-2 font-semibold">
                <CheckCircle className="text-green h-3.5 w-3.5" /> Feature Priority Poll
              </h5>
              <p>
                Designed to rank user preferences across proposed ideas, mods, or system features.
              </p>
            </div>

            <div>
              <h5 className="text-label mb-1 flex items-center gap-2 font-semibold">
                <CheckCircle className="text-green h-3.5 w-3.5" /> Feature Upvoting Board
              </h5>
              <p>
                Lists feature proposals with upvote cards, enabling citizens to upvote/downvote
                features in real-time.
              </p>
            </div>

            <div className="border-separator border-t pt-4">
              <p>
                <strong>Targeting Note:</strong> Restricting the scope to a country restricts ballot
                cast actions only to validated residents of that nation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
