"use client";

import React, { useState, useMemo } from "react";
import { Smile, Search, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

// Categorized popular unicode emojis
const EMOJI_CATEGORIES = [
  {
    name: "Smileys & Emotion",
    emojis: [
      { char: "😀", name: "grinning" },
      { char: "😃", name: "smiley" },
      { char: "😄", name: "smile" },
      { char: "😁", name: "grin" },
      { char: "😆", name: "laughing" },
      { char: "😅", name: "sweat_smile" },
      { char: "😂", name: "joy" },
      { char: "🤣", name: "rofl" },
      { char: "😊", name: "blush" },
      { char: "😇", name: "innocent" },
      { char: "🙂", name: "slight_smile" },
      { char: "🙃", name: "upside_down" },
      { char: "😉", name: "wink" },
      { char: "😌", name: "relieved" },
      { char: "😍", name: "heart_eyes" },
      { char: "🥰", name: "smiling_face_with_three_hearts" },
      { char: "😘", name: "kissing_heart" },
      { char: "😋", name: "yum" },
      { char: "😛", name: "stuck_out_tongue" },
      { char: "😜", name: "stuck_out_tongue_winking_eye" },
      { char: "🤪", name: "zany_face" },
      { char: "😝", name: "stuck_out_tongue_closed_eyes" },
      { char: "🤑", name: "money_mouth" },
      { char: "🤗", name: "hugs" },
      { char: "🤭", name: "hand_over_mouth" },
      { char: "🤫", name: "shushing" },
      { char: "🤔", name: "thinking" },
      { char: "🤐", name: "zipper_mouth" },
      { char: "🤨", name: "raised_eyebrow" },
      { char: "😐", name: "neutral" },
      { char: "😑", name: "expressionless" },
      { char: "😶", name: "no_mouth" },
      { char: "😏", name: "smirk" },
      { char: "😒", name: "unamused" },
      { char: "🙄", name: "eye_roll" },
      { char: "😬", name: "grimacing" },
      { char: "🤥", name: "lying" },
      { char: "😔", name: "pensive" },
      { char: "😪", name: "sleepy" },
      { char: "🤤", name: "drooling" },
      { char: "😴", name: "sleeping" },
      { char: "🤯", name: "exploding_head" },
      { char: "🤠", name: "cowboy" },
      { char: "🥳", name: "partying" },
      { char: "😎", name: "sunglasses" },
      { char: "🤓", name: "nerd" },
      { char: "🧐", name: "monocle" },
      { char: "😕", name: "confused" },
      { char: "😟", name: "worried" },
      { char: "🙁", name: "slight_frown" },
      { char: "☹️", name: "frowning" },
      { char: "😮", name: "open_mouth" },
      { char: "🥺", name: "pleading" },
      { char: "😢", name: "cry" },
      { char: "😭", name: "sob" },
      { char: "😱", name: "scream" },
      { char: "😤", name: "triumph" },
      { char: "😡", name: "rage" },
      { char: "😠", name: "angry" },
      { char: "🤬", name: "cursing" },
      { char: "💀", name: "skull" },
      { char: "💩", name: "poop" },
      { char: "🤡", name: "clown" },
      { char: "👻", name: "ghost" },
      { char: "👽", name: "alien" },
      { char: "👾", name: "space_invader" },
      { char: "🤖", name: "robot" },
    ],
  },
  {
    name: "Gestures & Body",
    emojis: [
      { char: "👋", name: "wave" },
      { char: "👌", name: "ok_hand" },
      { char: "🤌", name: "pinched_fingers" },
      { char: "🤏", name: "pinching" },
      { char: "✌️", name: "v_sign" },
      { char: "🤞", name: "crossed_fingers" },
      { char: "🤟", name: "love_you" },
      { char: "🤘", name: "metal" },
      { char: "🤙", name: "call_me" },
      { char: "👈", name: "point_left" },
      { char: "👉", name: "point_right" },
      { char: "👆", name: "point_up" },
      { char: "🖕", name: "middle_finger" },
      { char: "👇", name: "point_down" },
      { char: "👍", name: "thumbsup" },
      { char: "👎", name: "thumbsdown" },
      { char: "👊", name: "fist" },
      { char: "👏", name: "clap" },
      { char: "🙌", name: "raised_hands" },
      { char: "🙏", name: "pray" },
      { char: "💪", name: "muscle" },
      { char: "🧠", name: "brain" },
      { char: "👀", name: "eyes" },
      { char: "👄", name: "mouth" },
    ],
  },
  {
    name: "Hearts & Symbols",
    emojis: [
      { char: "❤️", name: "heart" },
      { char: "🧡", name: "orange_heart" },
      { char: "💛", name: "yellow_heart" },
      { char: "💚", name: "green_heart" },
      { char: "💙", name: "blue_heart" },
      { char: "💜", name: "purple_heart" },
      { char: "🖤", name: "black_heart" },
      { char: "🤍", name: "white_heart" },
      { char: "💔", name: "broken_heart" },
      { char: "❣️", name: "heart_exclamation" },
      { char: "💕", name: "two_hearts" },
      { char: "💞", name: "revolving_hearts" },
      { char: "💓", name: "heartbeat" },
      { char: "💖", name: "sparkles_heart" },
      { char: "💘", name: "cupid" },
      { char: "💝", name: "gift_heart" },
      { char: "☮️", name: "peace" },
      { char: "✝️", name: "cross" },
      { char: "☯️", name: "yin_yang" },
      { char: "⚠️", name: "warning" },
      { char: "🔥", name: "fire" },
      { char: "✨", name: "sparkles" },
      { char: "⭐", name: "star" },
      { char: "💯", name: "100" },
      { char: "🎉", name: "tada" },
      { char: "🎊", name: "confetti" },
    ],
  },
];

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  trigger?: React.ReactNode;
  disabled?: boolean;
}

export function EmojiPicker({ onSelectEmoji, trigger, disabled = false }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"unicode" | "discord">("unicode");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Discord emojis when popover is open
  const { data: discordEmojisData, isLoading: isLoadingDiscord } =
    api.thinkpages.getDiscordEmojis.useQuery(
      {},
      {
        enabled: isOpen && activeTab === "discord",
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      }
    );

  const discordEmojis = discordEmojisData?.emojis || [];

  // Filter Unicode Emojis based on search query
  const filteredUnicodeCategories = useMemo(() => {
    if (!searchQuery) return EMOJI_CATEGORIES;
    const query = searchQuery.toLowerCase();

    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter((emoji) => emoji.name.toLowerCase().includes(query)),
    })).filter((cat) => cat.emojis.length > 0);
  }, [searchQuery]);

  // Filter Discord Emojis based on search query
  const filteredDiscordEmojis = useMemo(() => {
    if (!searchQuery) return discordEmojis;
    const query = searchQuery.toLowerCase();
    return discordEmojis.filter((emoji) => emoji.name.toLowerCase().includes(query));
  }, [discordEmojis, searchQuery]);

  const handleSelectUnicode = (emojiChar: string) => {
    onSelectEmoji(emojiChar);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleSelectDiscord = (emoji: { name: string; id: string; animated?: boolean }) => {
    const markup = emoji.animated
      ? `<a:${emoji.name}:${emoji.id}>`
      : `<:${emoji.name}:${emoji.id}>`;
    onSelectEmoji(markup);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "inline-flex h-7 items-center justify-center rounded-md px-2 text-sm text-xs font-medium text-blue-400 transition-colors hover:bg-white/5 hover:text-blue-300 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <Smile className="mr-1 h-3.5 w-3.5" />
        Emoji
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="glass-hierarchy-child w-72 overflow-hidden border-blue-500/20 bg-neutral-900/90 p-0 shadow-xl backdrop-blur-xl"
      >
        {/* Search */}
        <div className="relative border-b border-white/10 p-2">
          <Search className="text-muted-foreground absolute top-4 left-4 h-3.5 w-3.5" />
          <Input
            placeholder="Search emojis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-white/10 bg-white/5 pl-8 text-xs focus:bg-white/10"
          />
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/10 bg-white/5 p-1">
          <button
            onClick={() => setActiveTab("unicode")}
            className={cn(
              "flex-1 rounded py-1 text-[11px] font-medium transition-all",
              activeTab === "unicode"
                ? "bg-blue-500/20 text-blue-400"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            Unicode
          </button>
          <button
            onClick={() => setActiveTab("discord")}
            className={cn(
              "flex-1 rounded py-1 text-[11px] font-medium transition-all",
              activeTab === "discord"
                ? "bg-blue-500/20 text-blue-400"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            Discord ({discordEmojisData?.count || 0})
          </button>
        </div>

        {/* Picker Content Area */}
        <div className="max-h-60 scrollbar-thin scrollbar-thumb-white/10 overflow-y-auto p-2">
          {activeTab === "unicode" ? (
            filteredUnicodeCategories.length > 0 ? (
              <div className="space-y-3">
                {filteredUnicodeCategories.map((category) => (
                  <div key={category.name} className="space-y-1">
                    <div className="px-1 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                      {category.name}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {category.emojis.map((emoji) => (
                        <button
                          key={emoji.name}
                          onClick={() => handleSelectUnicode(emoji.char)}
                          title={`:${emoji.name}:`}
                          className="flex h-8 w-8 items-center justify-center rounded text-lg transition-transform duration-100 hover:scale-125 hover:bg-white/10"
                        >
                          {emoji.char}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center text-xs">
                No matching emojis found
              </div>
            )
          ) : (
            /* Discord Emojis tab */
            <div>
              {isLoadingDiscord ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span>Loading server emojis...</span>
                </div>
              ) : filteredDiscordEmojis.length > 0 ? (
                <div className="grid grid-cols-6 gap-1.5 p-1">
                  {filteredDiscordEmojis.map((emoji) => (
                    <button
                      key={emoji.id}
                      onClick={() => handleSelectDiscord(emoji)}
                      title={`:${emoji.name}:`}
                      className="flex h-9 w-9 items-center justify-center rounded p-1 transition-transform duration-100 hover:scale-125 hover:bg-white/10"
                    >
                      <img
                        src={emoji.url}
                        alt={`:${emoji.name}:`}
                        className="h-6 w-6 object-contain"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground py-8 text-center text-xs">
                  {searchQuery ? "No matching custom emojis found" : "No server emojis available"}
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
