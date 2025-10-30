"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Smile, Star } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface DiscordEmoji {
  id: string;
  name: string;
  url: string;
  animated?: boolean;
  category?: string;
}

interface DiscordEmojiPickerProps {
  onEmojiSelect: (emoji: DiscordEmoji | string) => void;
  onClose?: () => void;
  maxHeight?: number;
  showUnicodeTab?: boolean;
  className?: string;
}

const UNICODE_EMOJI_CATEGORIES = {
  frequent: ["😀", "😂", "❤️", "👍", "👎", "😍", "😭", "🔥", "✨", "💯"],
  smileys: [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😇",
    "🙂",
    "🙃",
    "😉",
    "😌",
    "😍",
    "🥰",
    "😘",
    "😗",
    "😙",
    "😚",
    "😋",
    "😛",
    "😝",
    "😜",
    "🤪",
    "🤨",
    "🧐",
    "🤓",
    "😎",
    "🤩",
    "🥳",
  ],
  gestures: [
    "👍",
    "👎",
    "👌",
    "✌️",
    "🤞",
    "🤟",
    "🤘",
    "🤙",
    "👈",
    "👉",
    "👆",
    "🖕",
    "👇",
    "☝️",
    "👋",
    "🤚",
    "🖐️",
    "✋",
    "🖖",
    "👏",
    "🙌",
    "🤝",
    "🙏",
  ],
  objects: [
    "🔥",
    "✨",
    "💯",
    "💥",
    "💫",
    "💨",
    "🌟",
    "⭐",
    "🌈",
    "☀️",
    "🌙",
    "⚡",
    "❄️",
    "☃️",
    "🎉",
    "🎊",
    "🎁",
    "🎀",
  ],
  symbols: [
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "🤎",
    "💔",
    "❣️",
    "💕",
    "💞",
    "💓",
    "💗",
    "💖",
    "💘",
    "💝",
    "💟",
    "♥️",
    "💯",
    "💢",
    "💬",
    "💭",
  ],
};

export function DiscordEmojiPicker({
  onEmojiSelect,
  onClose,
  maxHeight = 400,
  showUnicodeTab = true,
  className = "",
}: DiscordEmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("frequent");
  const [activeTab, setActiveTab] = useState<"unicode" | "discord">("unicode");

  // Fetch Discord emojis
  const { data: discordEmojis, isLoading: discordEmojisLoading } =
    api.thinkpages.getDiscordEmojis.useQuery(
      {},
      {
        enabled: activeTab === "discord",
      }
    );

  const handleEmojiClick = useCallback(
    (emoji: DiscordEmoji | string) => {
      onEmojiSelect(emoji);
      onClose?.();
    },
    [onEmojiSelect, onClose]
  );

  const filterEmojis = (emojis: DiscordEmoji[]) => {
    if (!searchQuery) return emojis;
    return emojis.filter((emoji) => emoji.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const filterUnicodeEmojis = (emojis: string[]) => {
    if (!searchQuery) return emojis;
    // For Unicode emojis, we'd need a mapping of emoji to names
    // For now, return all when searching
    return emojis;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "bg-background border-border z-50 rounded-lg border shadow-lg",
        "w-80 max-w-sm",
        className
      )}
      style={{ maxHeight }}
    >
      {/* Header */}
      <div className="border-border border-b p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Add Reaction</h3>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emojis..."
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "unicode" | "discord")}
      >
        {showUnicodeTab && (
          <TabsList className="mx-3 mt-2 grid w-full grid-cols-2">
            <TabsTrigger value="unicode" className="text-xs">
              <Smile className="mr-1 h-3 w-3" />
              Unicode
            </TabsTrigger>
            <TabsTrigger value="discord" className="text-xs">
              <Star className="mr-1 h-3 w-3" />
              Discord
            </TabsTrigger>
          </TabsList>
        )}

        {/* Unicode Emojis */}
        {showUnicodeTab && (
          <TabsContent value="unicode" className="m-0">
            {/* Category Selector */}
            <div className="border-border border-b p-2">
              <div className="flex flex-wrap gap-1">
                {Object.keys(UNICODE_EMOJI_CATEGORIES).map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className="h-6 px-2 text-xs capitalize"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Unicode Emoji Grid */}
            <ScrollArea className="h-60">
              <div className="grid grid-cols-8 gap-1 p-3">
                {filterUnicodeEmojis(
                  UNICODE_EMOJI_CATEGORIES[
                    selectedCategory as keyof typeof UNICODE_EMOJI_CATEGORIES
                  ] || []
                ).map((emoji, index) => (
                  <button
                    key={`${emoji}-${index}`}
                    onClick={() => handleEmojiClick(emoji)}
                    className="hover:bg-accent rounded p-1 text-lg transition-colors"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        )}

        {/* Discord Emojis */}
        <TabsContent value="discord" className="m-0">
          <ScrollArea className="h-60">
            {discordEmojisLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2 p-3">
                {filterEmojis((discordEmojis as any) || []).map((emoji: any) => (
                  <button
                    key={emoji.id}
                    onClick={() => handleEmojiClick(emoji)}
                    className="hover:bg-accent group relative rounded p-1 transition-colors"
                    title={`:${emoji.name}:`}
                  >
                    <img src={emoji.url} alt={emoji.name} className="h-6 w-6 object-contain" />
                    {/* Animated badge */}
                    {emoji.animated && (
                      <Badge className="absolute -top-1 -right-1 h-3 w-3 p-0 text-xs">GIF</Badge>
                    )}
                  </button>
                ))}

                {/* No results */}
                {discordEmojis && filterEmojis(discordEmojis as any).length === 0 && (
                  <div className="text-muted-foreground col-span-6 py-4 text-center text-sm">
                    No emojis found
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="border-border text-muted-foreground border-t p-2 text-center text-xs">
        Click an emoji to add it to your message
      </div>
    </motion.div>
  );
}

// Compact version for inline use
export function CompactDiscordEmojiPicker({
  onEmojiSelect,
  trigger,
  children,
}: {
  onEmojiSelect: (emoji: DiscordEmoji | string) => void;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)} className="p-1">
          <Smile className="h-4 w-4" />
        </Button>
      )}

      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-2">
            <DiscordEmojiPicker
              onEmojiSelect={(emoji) => {
                onEmojiSelect(emoji);
                setIsOpen(false);
              }}
              onClose={() => setIsOpen(false)}
              maxHeight={300}
              showUnicodeTab={true}
            />
          </div>
        )}
      </AnimatePresence>

      {children}
    </div>
  );
}

// Helper function to format emoji for display
export function formatDiscordEmoji(emoji: DiscordEmoji): string {
  return `<img src="${emoji.url}" alt=":${emoji.name}:" class="inline-block h-5 w-5" title=":${emoji.name}:" />`;
}

// Helper function to format Unicode emoji
export function formatUnicodeEmoji(emoji: string): string {
  return emoji;
}
