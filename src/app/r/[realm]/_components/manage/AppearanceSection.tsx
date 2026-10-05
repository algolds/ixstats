"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { MAX_REALM_TAGS, REALM_TAGS, type RealmTag } from "~/lib/realms/realm-region";
import { ManageSection } from "./ManageSection";

/** Banner image, description and directory tags. */
export function AppearanceSection({
  slug,
  appearance,
}: {
  slug: string;
  appearance: { bannerUrl: string | null; description: string | null; tags: string[] };
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [bannerUrl, setBannerUrl] = useState(appearance.bannerUrl ?? "");
  const [description, setDescription] = useState(appearance.description ?? "");
  const [tags, setTags] = useState<string[]>(appearance.tags);
  const save = api.realms.region.updateAppearance.useMutation({
    onSuccess: () => {
      notify.success("Appearance saved");
      void utils.realms.region.invalidate();
      void utils.realms.directory.invalidate();
    },
    onError: (error) => notify.error("Could not save", error.message),
  });
  const bannerOk = bannerUrl.trim() === "" || /^https:\/\/\S+$/i.test(bannerUrl.trim());

  return (
    <ManageSection
      id="appearance"
      title="Appearance"
      description="The banner across the top of the realm page, its description and the tags the directory filters by."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="realm-banner">Banner image address</Label>
          <Input
            id="realm-banner"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://"
            aria-invalid={!bannerOk}
          />
          {!bannerOk && (
            <p className="text-destructive text-footnote">Use an https:// image address.</p>
          )}
          {bannerOk && bannerUrl.trim() && (
            <img
              src={bannerUrl.trim()}
              alt="Banner preview"
              className="border-separator rounded-row mt-1 h-28 w-full border object-cover"
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="realm-description">Description</Label>
          <Textarea
            id="realm-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-label text-footnote font-medium" id="realm-tags-label">
            Tags (up to {MAX_REALM_TAGS})
          </span>
          <ToggleGroup
            type="multiple"
            variant="pill"
            size="sm"
            aria-labelledby="realm-tags-label"
            value={tags}
            onValueChange={(next: string[]) => {
              if (next.length <= MAX_REALM_TAGS) setTags(next);
            }}
            className="flex-wrap justify-start"
          >
            {REALM_TAGS.map((tag) => (
              <ToggleGroupItem key={tag} value={tag}>
                {tag}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div>
          <Button
            disabled={!bannerOk || save.isPending}
            onClick={() =>
              save.mutate({
                slug,
                bannerUrl: bannerUrl.trim() || null,
                description: description.trim() || null,
                tags: tags as RealmTag[],
              })
            }
          >
            Save appearance
          </Button>
        </div>
      </div>
    </ManageSection>
  );
}
