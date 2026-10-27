"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ManageSection, type RealmManage } from "./ManageSection";

const MAX_OPTIONS = 10;

/** The realm poll: one open at a time, shown in the sidebar; owners of the realm's nations vote. */
export function PollsSection({ slug, manage }: { slug: string; manage: RealmManage }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [endDate, setEndDate] = useState("");
  const refresh = () => void utils.realms.region.invalidate();
  const create = api.realms.region.createPoll.useMutation({
    onSuccess: () => {
      notify.success("Poll opened");
      setQuestion("");
      setDescription("");
      setOptions(["", ""]);
      setMultiple(false);
      setEndDate("");
      refresh();
    },
    onError: (error) => notify.error("Could not open the poll", error.message),
  });
  const close = api.realms.region.closePoll.useMutation({
    onSuccess: () => {
      notify.success("Poll closed");
      refresh();
    },
    onError: (error) => notify.error("Could not close the poll", error.message),
  });
  const open = manage.polls.find((p) => p.isActive);
  const filled = options.map((o) => o.trim()).filter(Boolean);

  return (
    <ManageSection
      id="polls"
      title="Realm poll"
      description="One poll runs at a time, in the sidebar of the realm page."
    >
      <div className="flex flex-col gap-4">
        {manage.polls.length > 0 && (
          <ul className="divide-separator flex flex-col divide-y">
            {manage.polls.map((poll) => (
              <li
                key={poll.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-label text-body truncate">{poll.question}</p>
                  <p className="text-label-secondary text-footnote tabular-nums">
                    {poll.votes.toLocaleString()} votes · opened{" "}
                    {new Date(poll.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {poll.isActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={close.isPending}
                    onClick={() => close.mutate({ slug, pollId: poll.id })}
                  >
                    Close poll
                  </Button>
                ) : (
                  <Badge>Closed</Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        {open ? (
          <p className="text-label-secondary text-footnote">
            Close the current poll to open a new one.
          </p>
        ) : manage.archived ? null : (
          <form
            className="bg-fill-4 rounded-row flex flex-col gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({
                slug,
                question,
                description: description.trim() || undefined,
                options: filled,
                multiple,
                endDate: endDate ? new Date(`${endDate}T23:59:59`) : undefined,
              });
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="poll-question">Question</Label>
              <Input
                id="poll-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={300}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="poll-description">Details (optional)</Label>
              <Input
                id="poll-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-label text-footnote mb-2 font-medium">Options</legend>
              {options.map((option, index) => (
                <Input
                  key={index}
                  value={option}
                  onChange={(e) =>
                    setOptions((all) => all.map((o, i) => (i === index ? e.target.value : o)))
                  }
                  maxLength={200}
                  aria-label={`Option ${index + 1}`}
                />
              ))}
              {options.length < MAX_OPTIONS && (
                <div>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => setOptions((all) => [...all, ""])}
                  >
                    Add option
                  </Button>
                </div>
              )}
            </fieldset>
            <label className="text-label text-footnote flex items-center gap-2">
              <Checkbox
                checked={multiple}
                onCheckedChange={(checked) => setMultiple(checked === true)}
              />
              Voters may pick more than one option
            </label>
            <div className="flex flex-col gap-2">
              <Label htmlFor="poll-end">Ends (optional)</Label>
              <Input
                id="poll-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-48"
              />
            </div>
            <div>
              <Button
                type="submit"
                size="sm"
                disabled={!question.trim() || filled.length < 2 || create.isPending}
              >
                Open poll
              </Button>
            </div>
          </form>
        )}
      </div>
    </ManageSection>
  );
}
