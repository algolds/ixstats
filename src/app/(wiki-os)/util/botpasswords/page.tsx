"use client";
// src/app/(wiki-os)/util/botpasswords/page.tsx
// Special:BotPasswords — app-specific credentials for the WikiOS api.php endpoint (Pywikibot, AWB, bots).

import { useState } from "react";
import { Copy, Trash } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { AdminPage, FormField } from "~/components/wiki-os/admin/AdminPage";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";

/** A bot password just created: its login name and the password, which is never shown again. */
interface CreatedPassword {
  loginName: string;
  password: string;
}

export default function BotPasswordsPage() {
  const notify = useNotify();
  const utils = api.useUtils();
  const list = api.wikios.listBotPasswords.useQuery(undefined, { retry: false });
  const [appId, setAppId] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [created, setCreated] = useState<CreatedPassword | null>(null);

  const create = api.wikios.createBotPassword.useMutation({
    onSuccess: (result) => {
      setCreated({ loginName: result.loginName, password: result.password });
      setAppId("");
      setSelected(new Set());
      void utils.wikios.listBotPasswords.invalidate();
    },
    onError: (error) => notify.error("Could not create the bot password", error.message),
  });

  const remove = api.wikios.deleteBotPassword.useMutation({
    onSuccess: () => {
      notify.success("Bot password deleted", "Its sessions have ended.");
      void utils.wikios.listBotPasswords.invalidate();
    },
    onError: (error) => notify.error("Could not delete the bot password", error.message),
  });

  const toggle = (grant: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(grant);
      else next.delete(grant);
      return next;
    });

  const copy = (text: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => notify.success("Copied", "Paste it into your bot's configuration."))
      .catch(() => notify.error("Could not copy", "Select the text and copy it by hand."));
  };

  const data = list.data;
  const grantsOnOffer = data?.grants ?? [];

  return (
    <AdminPage
      title="Bot passwords"
      description="Let a bot (Pywikibot, AWB, your own script) use your wiki account through api.php, with only the rights you grant it."
    >
      {list.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
      {list.error && (
        <Alert variant="destructive">
          <AlertTitle>Bot passwords are not available</AlertTitle>
          <AlertDescription>{list.error.message}</AlertDescription>
        </Alert>
      )}

      {created && (
        <Alert>
          <AlertTitle>Copy this password now: it will not be shown again</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Log in as <code className="font-mono">{created.loginName}</code> with this password:
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-muted rounded px-2 py-1 font-mono text-sm break-all">
                {created.password}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Copy the password"
                onClick={() => copy(created.password)}
              >
                <Copy />
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreated(null)}>
              I have saved it
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Your bot passwords</h2>
            {data.botPasswords.length === 0 ? (
              <p className="text-muted-foreground text-sm">You have not created any yet.</p>
            ) : (
              <ul className="divide-border divide-y rounded-lg border">
                {data.botPasswords.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 p-3">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">
                        <code className="font-mono">
                          {data.wikiUsername}@{row.appId}
                        </code>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {row.grants.map((grant) => (
                          <Badge key={grant} variant="secondary">
                            {grant}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Created {new Date(row.createdAt).toLocaleDateString()}
                        {row.lastUsedAt
                          ? `, last used ${new Date(row.lastUsedAt).toLocaleDateString()}`
                          : ", never used"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Delete ${row.appId}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ id: row.id })}
                    >
                      <Trash />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate({
                appId: appId.trim(),
                grants: grantsOnOffer.map((row) => row.grant).filter((g) => selected.has(g)),
              });
            }}
          >
            <h2 className="text-sm font-semibold">Create a bot password</h2>
            <FormField
              label="App id"
              htmlFor="bot-app-id"
              hint="Letters, digits, spaces, underscores and hyphens, at most 32. Your bot logs in as your wiki name, an at sign and this id."
            >
              <Input
                id="bot-app-id"
                value={appId}
                maxLength={32}
                onChange={(e) => setAppId(e.target.value)}
                required
              />
            </FormField>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Grants</legend>
              {grantsOnOffer.map((row) => (
                <Label key={row.grant} className="gap-2">
                  <Checkbox
                    checked={row.grant === "basic" || selected.has(row.grant)}
                    disabled={row.grant === "basic"}
                    onCheckedChange={(value) => toggle(row.grant, value === true)}
                  />
                  <span>
                    <code className="font-mono text-xs">{row.grant}</code> — {row.description}
                  </span>
                </Label>
              ))}
              <p className="text-muted-foreground text-xs">
                A bot can never do more than your own account may, whatever it is granted.
              </p>
            </fieldset>
            <Button type="submit" disabled={!appId.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create bot password"}
            </Button>
          </form>
        </>
      )}
    </AdminPage>
  );
}
