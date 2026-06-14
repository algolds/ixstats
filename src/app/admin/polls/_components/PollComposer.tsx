"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
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
  Trash2,
  Plus,
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

interface PollComposerProps {
  onSuccess?: () => void;
}

export function PollComposer({ onSuccess }: PollComposerProps) {
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

  const { data: countriesData } = api.countries.getSelectList.useQuery({ limit: 250 });

  const createMutation = api.polls.create.useMutation({
    onSuccess: () => {
      toast.success("Poll created and broadcasted successfully!");
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
      toast.error(err.message || "Failed to create poll");
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
      toast.error("Please enter a question or topic");
      return;
    }
    if (step === 2 && targetScope === "country" && !countryId) {
      toast.error("Please select a target country");
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
      toast.error("Please enter a question");
      return;
    }

    const filteredOptions = options.map((opt) => opt.trim()).filter((opt) => opt.length > 0);
    if (filteredOptions.length < 2) {
      toast.error("At least 2 options are required");
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
        <Card className="border-border/20 bg-card/10 relative overflow-hidden border backdrop-blur-md">
          <CardHeader className="border-border/20 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2 text-base font-bold">
                <Sparkles className="h-4 w-4 text-[#ff8a65]" />
                Poll Wizard Composer
              </CardTitle>
              <span className="text-muted-foreground text-xs font-semibold">Step {step} of 3</span>
            </div>

            {/* Stepper Progress bar */}
            <div className="mt-4 flex items-center justify-between gap-2">
              // eslint-disable-next-line unused-imports/no-unused-vars
              {STEPS.map((s, _idx) => (
                <div key={s.number} className="flex flex-1 flex-col gap-1.5">
                  <div className="bg-muted/40 h-1 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        step >= s.number ? "bg-[#ff8a65]" : "bg-transparent"
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold tracking-tight transition-colors",
                      step === s.number ? "font-extrabold text-[#ff8a65]" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <form
              onSubmit={handleSubmit}
              className="flex min-h-[300px] flex-col justify-between space-y-6"
            >
              {/* Step 1 Content */}
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-3 space-y-4 duration-300">
                  <div className="space-y-2">
                    <Label
                      htmlFor="question"
                      className="text-foreground text-xs font-bold tracking-tight"
                    >
                      Poll Question / Topic *
                    </Label>
                    <Input
                      id="question"
                      placeholder="e.g., What should be our priority for the next national budget?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      className="bg-background/40 border-border/60 focus-visible:ring-[#ff8a65]"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="description"
                      className="text-foreground text-xs font-bold tracking-tight"
                    >
                      Description / Context (optional)
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Provide additional details or context to help citizens make an informed choice..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-background/40 border-border/60 focus-visible:ring-[#ff8a65]"
                      rows={5}
                    />
                  </div>
                </div>
              )}

              {/* Step 2 Content */}
              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-3 space-y-4 duration-300">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-foreground text-xs font-bold tracking-tight">
                        Poll Type
                      </Label>
                      <Select
                        value={pollType}
                        onValueChange={(val: "choice" | "feature-poll" | "feature-voting") => {
                          setPollType(val);
                          if (val === "feature-voting") {
                            setMultiple(true);
                          }
                        }}
                      >
                        <SelectTrigger className="bg-background/40 border-border/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/60">
                          <SelectItem value="choice">Standard Choice Poll</SelectItem>
                          <SelectItem value="feature-poll">Feature Priority Poll</SelectItem>
                          <SelectItem value="feature-voting">Feature Upvoting Board</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-foreground text-xs font-bold tracking-tight">
                        Scope & Targeting
                      </Label>
                      <Select
                        value={targetScope}
                        onValueChange={(val: "global" | "country") => setTargetScope(val)}
                      >
                        <SelectTrigger className="bg-background/40 border-border/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/60">
                          <SelectItem value="global">Global (All Users)</SelectItem>
                          <SelectItem value="country">Country Targeted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {targetScope === "country" && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-2 duration-200">
                      <Label className="text-foreground text-xs font-bold tracking-tight">
                        Target Country *
                      </Label>
                      <Select value={countryId} onValueChange={setCountryId}>
                        <SelectTrigger className="bg-background/40 border-border/60">
                          <SelectValue placeholder="Select country to restrict voting to" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/60">
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
                        className="text-foreground flex items-center gap-1.5 text-xs font-bold tracking-tight"
                      >
                        <Calendar className="text-muted-foreground h-4 w-4" />
                        Expiry Date (optional)
                      </Label>
                      <Input
                        id="endDate"
                        type="datetime-local"
                        value={endDateStr}
                        onChange={(e) => setEndDateStr(e.target.value)}
                        className="bg-background/40 border-border/60 dark:[color-scheme:dark]"
                      />
                    </div>

                    {pollType !== "feature-voting" && (
                      <div className="flex items-center gap-2 pt-6">
                        <Switch id="multiple" checked={multiple} onCheckedChange={setMultiple} />
                        <Label
                          htmlFor="multiple"
                          className="text-foreground cursor-pointer text-xs font-bold tracking-tight"
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
                <div className="animate-in fade-in slide-in-from-right-3 space-y-4 duration-300">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground text-xs font-bold">List Poll Options *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddOption}
                      className="h-8 cursor-pointer gap-1 border-[#ff8a65]/35 text-xs font-semibold text-[#ff8a65] hover:bg-[#ff8a65]/10 dark:text-[#ff8a65]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Option
                    </Button>
                  </div>

                  <div className="max-h-[260px] space-y-2.5 overflow-y-auto pr-1">
                    {options.map((option, idx) => (
                      <div
                        key={idx}
                        className="animate-in fade-in flex items-center gap-2 duration-200"
                      >
                        <span className="text-muted-foreground/60 w-6 text-center text-xs font-bold">
                          {idx + 1}.
                        </span>
                        <Input
                          placeholder={`Option label ${idx + 1}`}
                          value={option}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          className="bg-background/40 border-border/60 flex-1 text-xs"
                          required
                        />
                        {options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(idx)}
                            className="h-8 w-8 shrink-0 cursor-pointer text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#ff8a65]/20 bg-[#ff8a65]/5 p-3 text-xs text-[#ff8a65]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Review all parameters. Clicking <strong>Create & Publish</strong> will record
                      the poll and publish an announcement card directly to the active feeds.
                    </span>
                  </div>
                </div>
              )}

              {/* Navigation Actions */}
              <div className="border-border/20 mt-6 flex justify-between gap-3 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={step === 1}
                  className="border-border/60 h-9 cursor-pointer gap-1.5 text-xs font-semibold"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>

                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="h-9 cursor-pointer gap-1.5 bg-[#ff8a65] text-xs font-semibold text-white hover:bg-[#ff8a65]/90"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="h-9 cursor-pointer gap-1.5 bg-[#ff8a65] px-6 text-xs font-semibold text-white hover:bg-[#ff8a65]/90"
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
        <Card className="border-border/20 bg-card/10 border backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2 text-sm font-bold">
              🗳️ Poll Creation Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3.5 text-xs leading-relaxed">
            <div>
              <h5 className="text-foreground mb-1 flex items-center gap-1.5 font-bold">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Standard Choice Poll
              </h5>
              <p>
                Classic single or multiple choice query. Displays vote bar charts and raw counts to
                citizens.
              </p>
            </div>

            <div>
              <h5 className="text-foreground mb-1 flex items-center gap-1.5 font-bold">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Feature Priority Poll
              </h5>
              <p>
                Designed to rank user preferences across proposed ideas, mods, or system features.
              </p>
            </div>

            <div>
              <h5 className="text-foreground mb-1 flex items-center gap-1.5 font-bold">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Feature Upvoting Board
              </h5>
              <p>
                Lists feature proposals with upvote cards, enabling citizens to upvote/downvote
                features in real-time.
              </p>
            </div>

            <div className="border-border/20 border-t pt-3.5">
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
