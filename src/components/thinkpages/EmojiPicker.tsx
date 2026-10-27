"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Emoji as Smile,
  SystemRestart as Loader2,
  Emoji as Cat,
  Shop as Pizza,
  Trophy,
  Airplane as Plane,
  LightBulb as Lightbulb,
  Heart,
  WhiteFlag as Flag,
} from "iconoir-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

// Categorized popular unicode emojis
const EMOJI_CATEGORIES = [
  {
    name: "Smileys & People",
    icon: Smile,
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
      { char: "🤖", name: "robot" },
      { char: "👋", name: "wave" },
      { char: "👌", name: "ok_hand" },
      { char: "👍", name: "thumbsup" },
      { char: "👎", name: "thumbsdown" },
      { char: "👊", name: "fist" },
      { char: "👏", name: "clap" },
      { char: "🙌", name: "raised_hands" },
      { char: "🙏", name: "pray" },
      { char: "💪", name: "muscle" },
      { char: "🧠", name: "brain" },
      { char: "👀", name: "eyes" },
    ],
  },
  {
    name: "Animals & Nature",
    icon: Cat,
    emojis: [
      { char: "🐶", name: "dog" },
      { char: "🐱", name: "cat" },
      { char: "🐭", name: "mouse" },
      { char: "🐹", name: "hamster" },
      { char: "🐰", name: "rabbit" },
      { char: "🦊", name: "fox" },
      { char: "🐻", name: "bear" },
      { char: "🐼", name: "panda" },
      { char: "🐨", name: "koala" },
      { char: "🐯", name: "tiger" },
      { char: "🦁", name: "lion" },
      { char: "🐮", name: "cow" },
      { char: "🐷", name: "pig" },
      { char: "🐸", name: "frog" },
      { char: "🐵", name: "monkey" },
      { char: "🐔", name: "chicken" },
      { char: "🐧", name: "penguin" },
      { char: "🐦", name: "bird" },
      { char: "🦆", name: "duck" },
      { char: "🦅", name: "eagle" },
      { char: "🦉", name: "owl" },
      { char: "🦇", name: "bat" },
      { char: "🐝", name: "bee" },
      { char: "🐛", name: "bug" },
      { char: "🦋", name: "butterfly" },
      { char: "🐌", name: "snail" },
      { char: "🐞", name: "ladybug" },
      { char: "🐜", name: "ant" },
      { char: "🕷️", name: "spider" },
      { char: "🐢", name: "turtle" },
      { char: "🐍", name: "snake" },
      { char: "🦎", name: "lizard" },
      { char: "🦖", name: "t-rex" },
      { char: "🐙", name: "octopus" },
      { char: "🦑", name: "squid" },
      { char: "🐠", name: "fish" },
      { char: "🐬", name: "dolphin" },
      { char: "🐳", name: "whale" },
      { char: "🦈", name: "shark" },
      { char: "🌲", name: "pine_tree" },
      { char: "🌳", name: "tree" },
      { char: "🌴", name: "palm_tree" },
      { char: "🌵", name: "cactus" },
      { char: "🍀", name: "clover" },
      { char: "🍁", name: "maple_leaf" },
      { char: "🍂", name: "fallen_leaf" },
      { char: "🌸", name: "cherry_blossom" },
      { char: "🌹", name: "rose" },
      { char: "🌻", name: "sunflower" },
      { char: "🌷", name: "tulip" },
    ],
  },
  {
    name: "Food & Drink",
    icon: Pizza,
    emojis: [
      { char: "🍇", name: "grapes" },
      { char: "🍉", name: "watermelon" },
      { char: "🍊", name: "tangerine" },
      { char: "🍋", name: "lemon" },
      { char: "🍌", name: "banana" },
      { char: "🍍", name: "pineapple" },
      { char: "🍎", name: "red_apple" },
      { char: "🍐", name: "pear" },
      { char: "🍒", name: "cherries" },
      { char: "🍓", name: "strawberry" },
      { char: "🫐", name: "blueberry" },
      { char: "🥑", name: "avocado" },
      { char: "🍆", name: "eggplant" },
      { char: "🥔", name: "potato" },
      { char: "🥕", name: "carrot" },
      { char: "🌽", name: "corn" },
      { char: "🌶️", name: "hot_pepper" },
      { char: "🍄", name: "mushroom" },
      { char: "🍞", name: "bread" },
      { char: "🧀", name: "cheese" },
      { char: "🍖", name: "meat_on_bone" },
      { char: "🍗", name: "poultry_leg" },
      { char: "🥩", name: "steak" },
      { char: "🥓", name: "bacon" },
      { char: "🍔", name: "hamburger" },
      { char: "🍟", name: "french_fries" },
      { char: "🍕", name: "pizza" },
      { char: "🌭", name: "hotdog" },
      { char: "🥪", name: "sandwich" },
      { char: "🌮", name: "taco" },
      { char: "🍳", name: "egg" },
      { char: "🥗", name: "salad" },
      { char: "🍿", name: "popcorn" },
      { char: "🍣", name: "sushi" },
      { char: "🥟", name: "dumpling" },
      { char: "🍦", name: "icecream" },
      { char: "🍩", name: "donut" },
      { char: "🍪", name: "cookie" },
      { char: "🎂", name: "birthday" },
      { char: "🍫", name: "chocolate" },
      { char: "🍬", name: "candy" },
      { char: "☕", name: "coffee" },
      { char: "🍵", name: "tea" },
      { char: "🍾", name: "champagne" },
      { char: "🍷", name: "wine" },
      { char: "🍸", name: "cocktail" },
      { char: "🍺", name: "beer" },
      { char: "🍻", name: "beers" },
      { char: "🥤", name: "soda" },
      { char: "🧊", name: "ice" },
    ],
  },
  {
    name: "Activity",
    icon: Trophy,
    emojis: [
      { char: "⚽", name: "soccer" },
      { char: "🏀", name: "basketball" },
      { char: "🏈", name: "football" },
      { char: "⚾", name: "baseball" },
      { char: "🥎", name: "softball" },
      { char: "🎾", name: "tennis" },
      { char: "🏐", name: "volleyball" },
      { char: "🎱", name: "billiards" },
      { char: "🏓", name: "ping_pong" },
      { char: "🏹", name: "archery" },
      { char: "🥊", name: "boxing" },
      { char: "🥋", name: "martial_arts" },
      { char: "⛳", name: "golf" },
      { char: "⛸️", name: "ice_skate" },
      { char: "🎯", name: "darts" },
      { char: "🎮", name: "video_game" },
      { char: "🕹️", name: "joystick" },
      { char: "🎰", name: "slot_machine" },
      { char: "🎲", name: "dice" },
      { char: "🧩", name: "puzzle" },
      { char: "♟️", name: "chess" },
      { char: "🎭", name: "theater" },
      { char: "🎨", name: "art" },
      { char: "🎟️", name: "ticket" },
      { char: "🎪", name: "circus" },
      { char: "🏆", name: "trophy" },
      { char: "🥇", name: "first_place" },
      { char: "🥈", name: "second_place" },
      { char: "🥉", name: "third_place" },
      { char: "🎖️", name: "military_medal" },
      { char: "🎸", name: "guitar" },
      { char: "🎺", name: "trumpet" },
      { char: "🎻", name: "violin" },
      { char: "🥁", name: "drum" },
      { char: "🎹", name: "keyboard_instrument" },
      { char: "🎧", name: "headphones" },
      { char: "🎤", name: "microphone" },
    ],
  },
  {
    name: "Travel & Places",
    icon: Plane,
    emojis: [
      { char: "🚗", name: "car" },
      { char: "🚕", name: "taxi" },
      { char: "🚙", name: "suv" },
      { char: "🚌", name: "bus" },
      { char: "🏎️", name: "racecar" },
      { char: "🚓", name: "police_car" },
      { char: "🚑", name: "ambulance" },
      { char: "🚒", name: "fire_engine" },
      { char: "🚜", name: "tractor" },
      { char: "🚲", name: "bicycle" },
      { char: "🛴", name: "scooter" },
      { char: "🚨", name: "siren" },
      { char: "🛑", name: "stop_sign" },
      { char: "⚓", name: "anchor" },
      { char: "⛵", name: "sailboat" },
      { char: "🚤", name: "speedboat" },
      { char: "🚢", name: "ship" },
      { char: "✈️", name: "airplane" },
      { char: "🚀", name: "rocket" },
      { char: "🛸", name: "ufo" },
      { char: "🌙", name: "crescent_moon" },
      { char: "☀️", name: "sun" },
      { char: "☁️", name: "cloud" },
      { char: "🌧️", name: "rain" },
      { char: "❄️", name: "snowflake" },
      { char: "🌋", name: "volcano" },
      { char: "🏔️", name: "mountain" },
      { char: "🗻", name: "mount_fuji" },
      { char: "🏕️", name: "camping" },
      { char: "🏖️", name: "beach" },
      { char: "🏜️", name: "desert" },
      { char: "🏢", name: "office_building" },
      { char: "🏫", name: "school" },
      { char: "🏰", name: "castle" },
      { char: "🏯", name: "japanese_castle" },
      { char: "🗼", name: "tokyo_tower" },
      { char: "🗽", name: "statue_of_liberty" },
      { char: "⛪", name: "church" },
      { char: "🕌", name: "mosque" },
    ],
  },
  {
    name: "Objects",
    icon: Lightbulb,
    emojis: [
      { char: "⌚", name: "watch" },
      { char: "📱", name: "iphone" },
      { char: "💻", name: "laptop" },
      { char: "⌨️", name: "keyboard" },
      { char: "🖱️", name: "mouse" },
      { char: "💿", name: "minidisc" },
      { char: "📅", name: "calendar" },
      { char: "📈", name: "chart_increasing" },
      { char: "📉", name: "chart_decreasing" },
      { char: "📊", name: "bar_chart" },
      { char: "📌", name: "pushpin" },
      { char: "📍", name: "round_pushpin" },
      { char: "📎", name: "paperclip" },
      { char: "📏", name: "straight_ruler" },
      { char: "📐", name: "triangular_ruler" },
      { char: "✂️", name: "scissors" },
      { char: "🔒", name: "lock" },
      { char: "🔓", name: "unlock" },
      { char: "🔑", name: "key" },
      { char: "🗝️", name: "old_key" },
      { char: "🔨", name: "hammer" },
      { char: "🛠️", name: "tools" },
      { char: "🛡️", name: "shield" },
      { char: "⚙️", name: "gear" },
      { char: "⛓️", name: "chains" },
      { char: "🔬", name: "microscope" },
      { char: "🔭", name: "telescope" },
      { char: "📡", name: "satellite" },
      { char: "🧪", name: "test_tube" },
      { char: "💵", name: "dollar" },
      { char: "🪙", name: "coin" },
      { char: "💳", name: "credit_card" },
      { char: "✉️", name: "envelope" },
      { char: "📧", name: "email" },
      { char: "📦", name: "package" },
      { char: "🗳️", name: "ballot_box" },
      { char: "✏️", name: "pencil" },
      { char: "👑", name: "crown" },
      { char: "🎒", name: "backpack" },
      { char: "💼", name: "briefcase" },
      { char: "🕶️", name: "sunglasses_obj" },
      { char: "💡", name: "lightbulb" },
      { char: "🕯️", name: "candle" },
      { char: "🔋", name: "battery" },
    ],
  },
  {
    name: "Symbols",
    icon: Heart,
    emojis: [
      { char: "❤️", name: "red_heart" },
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
      { char: "🚫", name: "prohibited" },
      { char: "❌", name: "cross_mark" },
      { char: "⭕", name: "circle_mark" },
      { char: "❓", name: "question" },
      { char: "❔", name: "grey_question" },
      { char: "❕", name: "grey_exclamation" },
      { char: "‼️", name: "double_exclamation" },
      { char: "♾️", name: "infinity" },
      { char: "➕", name: "plus" },
      { char: "➖", name: "minus" },
      { char: "✖️", name: "multiply" },
      { char: "➗", name: "divide" },
    ],
  },
  {
    name: "Flags",
    icon: Flag,
    emojis: [
      { char: "🏁", name: "chequered_flag" },
      { char: "🚩", name: "triangular_flag" },
      { char: "🎌", name: "crossed_flags" },
      { char: "🏴", name: "black_flag" },
      { char: "🏳️", name: "white_flag" },
      { char: "🏳️‍🌈", name: "rainbow_flag" },
      { char: "🏳️‍⚧️", name: "transgender_flag" },
      { char: "🏴‍☠️", name: "pirate_flag" },
      { char: "🇺🇸", name: "usa" },
      { char: "🇺🇳", name: "un" },
      { char: "🇨🇳", name: "china" },
      { char: "🇯🇵", name: "japan" },
      { char: "🇩🇪", name: "germany" },
      { char: "🇬🇧", name: "uk" },
      { char: "🇫🇷", name: "france" },
      { char: "🇮🇹", name: "italy" },
      { char: "🇷🇺", name: "russia" },
      { char: "🇪🇸", name: "spain" },
      { char: "🇨🇦", name: "canada" },
      { char: "🇦🇺", name: "australia" },
      { char: "🇧🇷", name: "brazil" },
      { char: "🇮🇳", name: "india" },
      { char: "🇲🇽", name: "mexico" },
      { char: "🇰🇷", name: "south_korea" },
      { char: "🇿🇦", name: "south_africa" },
      { char: "🇪🇺", name: "eu" },
    ],
  },
];

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  trigger?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "bottom" | "left" | "right";
}

export function EmojiPicker({
  onSelectEmoji,
  trigger,
  disabled = false,
  className,
  onOpenChange,
  side = "top",
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"unicode" | "discord">("unicode");
  const [searchQuery, setSearchQuery] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // oxlint-disable-next-line
  }, [discordEmojis, searchQuery]);

  const handleSelectUnicode = (emojiChar: string) => {
    onSelectEmoji(emojiChar);
    setIsOpen(false);
    onOpenChange?.(false);
    setSearchQuery("");
  };

  const handleSelectDiscord = (emoji: { name: string; id: string; animated?: boolean }) => {
    const markup = emoji.animated
      ? `<a:${emoji.name}:${emoji.id}>`
      : `<:${emoji.name}:${emoji.id}>`;
    onSelectEmoji(markup);
    setIsOpen(false);
    onOpenChange?.(false);
    setSearchQuery("");
  };

  const scrollToCategory = (index: number) => {
    const container = scrollRef.current;
    const element = container?.querySelector(`#emoji-category-${index}`) as HTMLElement;
    if (container && element) {
      const containerTop = container.getBoundingClientRect().top;
      const elementTop = element.getBoundingClientRect().top;
      const relativeTop = elementTop - containerTop + container.scrollTop;
      container.scrollTo({ top: relativeTop - 8, behavior: "smooth" });
    }
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        onOpenChange?.(open);
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label="Insert emoji"
            className={cn(
              "text-tint hover:bg-tint-fill hover:text-tint size-7 rounded-full p-0",
              isOpen && "bg-tint-fill",
              className
            )}
          >
            <Smile className="size-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="center"
        sideOffset={8}
        className="w-80 overflow-hidden p-0"
      >
        <div className="border-separator border-b p-2">
          <SearchField
            size="sm"
            placeholder="Search emojis..."
            aria-label="Search emojis"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
        </div>

        <div className="border-separator border-b p-2">
          <SegmentedControl
            size="sm"
            fullWidth
            aria-label="Emoji set"
            value={activeTab}
            onValueChange={setActiveTab}
            // Keep focus in the search field / editor while switching sets.
            onMouseDown={(e) => e.preventDefault()}
            options={[
              { value: "unicode", label: "Unicode" },
              { value: "discord", label: `Discord (${discordEmojisData?.count || 0})` },
            ]}
          />
        </div>

        <div ref={scrollRef} className="thin-scrollbar max-h-60 overflow-y-auto p-2">
          {activeTab === "unicode" ? (
            filteredUnicodeCategories.length > 0 ? (
              <div className="space-y-3 pb-8">
                {filteredUnicodeCategories.map((category, idx) => (
                  <div
                    key={category.name}
                    id={`emoji-category-${idx}`}
                    className="scroll-mt-2 space-y-1"
                  >
                    <div className="text-subhead text-label-secondary px-1">{category.name}</div>
                    <div className="grid grid-cols-8 gap-1">
                      {category.emojis.map((emoji) => (
                        <button
                          key={emoji.name}
                          onClick={() => handleSelectUnicode(emoji.char)}
                          title={`:${emoji.name}:`}
                          className="hover:bg-fill-3 rounded-control-sm flex size-8 items-center justify-center text-[1.35rem] leading-none transition-[background-color,scale] duration-100 hover:scale-125"
                        >
                          {emoji.char}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-footnote text-label-secondary py-8 text-center">
                No matching emojis found
              </div>
            )
          ) : (
            /* Discord Emojis tab */
            <div className="pb-8">
              {isLoadingDiscord ? (
                <div className="text-footnote text-label-secondary flex flex-col items-center justify-center gap-2 py-8">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Loading server emojis...</span>
                </div>
              ) : filteredDiscordEmojis.length > 0 ? (
                <div className="grid grid-cols-6 gap-2 p-1">
                  {filteredDiscordEmojis.map((emoji) => (
                    <button
                      key={emoji.id}
                      onClick={() => handleSelectDiscord(emoji)}
                      title={`:${emoji.name}:`}
                      className="hover:bg-fill-3 rounded-control-sm flex size-9 items-center justify-center p-1 transition-[background-color,scale] duration-100 hover:scale-125"
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
                <div className="text-label-secondary text-footnote py-8 text-center">
                  {searchQuery ? "No matching custom emojis found" : "No server emojis available"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Navigation Bar (iOS Style) at the Bottom */}
        {activeTab === "unicode" && !searchQuery && (
          <div className="border-separator flex items-center justify-around border-t py-2">
            {EMOJI_CATEGORIES.map((category, idx) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => scrollToCategory(idx)}
                  className="text-label-secondary hover:text-label transition-colors"
                  title={category.name}
                  aria-label={category.name}
                >
                  <Icon className="size-4" />
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
