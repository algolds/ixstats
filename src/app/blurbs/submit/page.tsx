"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { usePageTitle } from "~/hooks/usePageTitle";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { CheckCircle, User } from "lucide-react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import { BlurbsNav } from "~/components/blurbs/BlurbsNav";

function SubmitPromptForm() {
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = api.blurbs.submitPrompt.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setTitle("");
      setQuestion("");
    },
  });

  if (submitted) {
    return (
      <Card className="glass-hierarchy-child">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-400" />
          <h3 className="text-base font-semibold">Prompt Submitted</h3>
          <p className="text-sm text-muted-foreground">
            Your prompt has been submitted for review. An admin will publish it once approved.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSubmitted(false)}>
              Submit another
            </Button>
            <Link href={withBasePath("/blurbs")}>
              <Button size="sm">Browse Prompts</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="glass-hierarchy-child">
        <CardContent className="p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Topic Tuesday: Fashion"'
              maxLength={200}
              className="w-full rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-3 py-2 text-sm text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] focus:outline-none focus:border-[var(--wikios-accent)]"
            />
            <span className="text-[10px] text-muted-foreground">{title.length}/200</span>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like the community to share about their countries?"
              maxLength={500}
              rows={4}
              className="w-full rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-3 py-2 text-sm text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] focus:outline-none focus:border-[var(--wikios-accent)] resize-none"
            />
            <span className="text-[10px] text-muted-foreground">{question.length}/500</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Submitted as draft for admin review
            </Badge>
            <Button
              size="sm"
              onClick={() => submitMutation.mutate({ title, question })}
              disabled={!title.trim() || !question.trim() || submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Prompt"}
            </Button>
          </div>

          {submitMutation.error && (
            <p className="text-xs text-red-400">{submitMutation.error.message}</p>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">Tips for good prompts</h3>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>Ask about culture, daily life, history, or unique aspects of a nation</li>
          <li>Keep questions open-ended so every country can answer</li>
          <li>Avoid yes/no questions &mdash; encourage storytelling</li>
          <li>Look at existing prompts for inspiration</li>
        </ul>
      </div>
    </div>
  );
}

export default function SubmitBlurbPage() {
  usePageTitle({ title: "Submit a Prompt" });
  const { isSignedIn } = useAuth();

  return (
    <WikiOSLayout>
      <div className="mx-auto max-w-3xl py-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Submit a Prompt</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Suggest a prompt for the community. Admins will review and publish it.
            </p>
          </div>
          <BlurbsNav />
        </div>

        {isSignedIn ? (
          <SubmitPromptForm />
        ) : (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <User className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-base font-semibold">Sign In Required</h3>
              <p className="text-sm text-muted-foreground">
                Sign in to submit a prompt suggestion.
              </p>
              <Link href={withBasePath("/setup")}>
                <Button size="sm">Sign In</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </WikiOSLayout>
  );
}
