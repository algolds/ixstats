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
import { Trash2, Plus, Send, X, Calendar } from "lucide-react";
import { toast } from "sonner";

interface PollComposerProps {
  onSuccess?: () => void;
}

export function PollComposer({ onSuccess }: PollComposerProps) {
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
      toast.success("Poll created successfully!");
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="border border-border/40 bg-card/30 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="h-5 w-5 text-purple-500" />
              Create New Poll
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="question" className="text-foreground text-sm font-semibold">
                  Poll Question / Topic *
                </Label>
                <Input
                  id="question"
                  placeholder="e.g., What should be our priority for the next national budget?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="bg-background/50 border-border/60"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground text-sm font-semibold">
                  Description / Context (optional)
                </Label>
                <Textarea
                  id="description"
                  placeholder="Provide additional details or context for voters..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-background/50 border-border/60"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-semibold">Poll Type</Label>
                  <Select
                    value={pollType}
                    onValueChange={(val: "choice" | "feature-poll" | "feature-voting") => {
                      setPollType(val);
                      if (val === "feature-voting") {
                        setMultiple(true); // Feature voting typically allows multiple upvotes
                      }
                    }}
                  >
                    <SelectTrigger className="bg-background/50 border-border/60">
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
                  <Label className="text-foreground text-sm font-semibold">Scope & Targeting</Label>
                  <Select
                    value={targetScope}
                    onValueChange={(val: "global" | "country") => setTargetScope(val)}
                  >
                    <SelectTrigger className="bg-background/50 border-border/60">
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
                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-semibold">Target Country *</Label>
                  <Select value={countryId} onValueChange={setCountryId}>
                    <SelectTrigger className="bg-background/50 border-border/60">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-foreground text-sm font-semibold flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Expiry Date (optional)
                  </Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="bg-background/50 border-border/60 dark:[color-scheme:dark]"
                  />
                </div>

                {pollType !== "feature-voting" && (
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      id="multiple"
                      checked={multiple}
                      onCheckedChange={setMultiple}
                    />
                    <Label htmlFor="multiple" className="text-foreground text-sm font-semibold cursor-pointer">
                      Allow Multiple Choices
                    </Label>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <Label className="text-foreground text-sm font-bold">
                    Poll Options *
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                    className="h-8 gap-1 border-purple-500/35 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Option
                  </Button>
                </div>

                <div className="space-y-2">
                  {options.map((option, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-muted-foreground/60 text-xs font-bold w-6 text-center">
                        {idx + 1}.
                      </span>
                      <Input
                        placeholder={`Option ${idx + 1}`}
                        value={option}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        className="bg-background/50 border-border/60 flex-1"
                        required
                      />
                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOption(idx)}
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/40 pt-4 flex justify-end gap-3">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5 px-6"
                >
                  {createMutation.isPending ? "Creating..." : (
                    <>
                      <Send className="h-4 w-4" /> Create & Publish
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border border-border/40 bg-card/30 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              🗳️ Poll Creation Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong>Standard Choice Poll:</strong> Classic single or multiple choice query. Displays bar charts and counts to voters.
            </p>
            <p>
              <strong>Feature Priority Poll:</strong> Designed to gauge preference across proposed items/features using a specialized layout.
            </p>
            <p>
              <strong>Feature Upvoting Board:</strong> Lists cards with upvote tallies, letting users upvote or unvote features at any time.
            </p>
            <p className="border-t border-border/20 pt-3">
              <strong>Targeting:</strong> Specifying a targeted country limits voting permissions strictly to verified citizens of that country.
            </p>
            <p>
              <strong>Feeds:</strong> Creating a poll automatically injects an announcement post into the Activity Feed. Deleting a poll removes the feed item automatically.
            </p>
           
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
