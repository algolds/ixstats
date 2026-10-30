"use client";
// The caption, size and alignment of an image the editor is about to place in an article.

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { CommonsImage } from "~/components/wiki-os/media-search/types";

interface ImageInsertFormProps {
  image: CommonsImage;
  onInsert: (wikitext: string) => void;
}

/** Select items cannot carry an empty value; "Full size" is the empty wikitext size. */
const FULL_SIZE = "full";

const DEFAULT_SIZE = "thumb";
const DEFAULT_ALIGN = "right";

/** `[[File:Name.ext|size|align|caption]]`; a result title may or may not carry the `File:` prefix. */
export function imageWikitext(
  title: string,
  size = DEFAULT_SIZE,
  align = DEFAULT_ALIGN,
  caption = ""
): string {
  const parts = [`File:${title.replace(/^File:/, "")}`];
  if (size) parts.push(size);
  if (align && align !== "none") parts.push(align);
  if (caption.trim()) parts.push(caption.trim());
  return `[[${parts.join("|")}]]`;
}

export function ImageInsertForm({ image, onInsert }: ImageInsertFormProps) {
  const [caption, setCaption] = useState("");
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [align, setAlign] = useState(DEFAULT_ALIGN);

  const insert = () => onInsert(imageWikitext(image.title, size, align, caption));

  return (
    <div className="border-separator bg-surface flex shrink-0 flex-wrap items-end gap-3 border-t px-4 py-3">
      <label className="wikios-img-insert-label min-w-48 flex-1">
        Caption
        <Input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Image caption..."
          onKeyDown={(e) => {
            if (e.key === "Enter") insert();
          }}
        />
      </label>

      <div className="wikios-img-insert-label w-36">
        <span id="wikios-img-insert-size">Size</span>
        <Select value={size || FULL_SIZE} onValueChange={(v) => setSize(v === FULL_SIZE ? "" : v)}>
          <SelectTrigger aria-labelledby="wikios-img-insert-size" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thumb">Thumbnail</SelectItem>
            <SelectItem value="frame">Frame</SelectItem>
            <SelectItem value="frameless">Frameless</SelectItem>
            <SelectItem value={FULL_SIZE}>Full size</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="wikios-img-insert-label w-32">
        <span id="wikios-img-insert-align">Align</span>
        <Select value={align} onValueChange={setAlign}>
          <SelectTrigger aria-labelledby="wikios-img-insert-align" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="right">Right</SelectItem>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={insert}>Insert image</Button>
    </div>
  );
}
