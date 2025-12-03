import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
  triggerClassName?: string;
}

const EMOJI_CATEGORIES = {
  "Smileys": [
    "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂",
    "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛",
    "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨",
    "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌",
  ],
  "Gestures": [
    "👍", "👎", "👊", "✊", "🤛", "🤜", "🤝", "👏", "🙌", "👐",
    "🤲", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉",
    "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙", "💪",
  ],
  "Hearts": [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
    "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️",
  ],
  "Objects": [
    "🔥", "✨", "⭐", "🌟", "💫", "⚡", "💥", "💢", "💯", "🎉",
    "🎊", "🎁", "🏆", "🥇", "🏅", "🎯", "💡", "📌", "📍", "🔔",
    "🎵", "🎶", "🔑", "🗝️", "💰", "💎", "🔮", "🧲", "⏰", "🕐",
  ],
  "Nature": [
    "🌸", "🌺", "🌻", "🌼", "🌷", "🌹", "🥀", "🌱", "🌲", "🌳",
    "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🌍",
  ],
  "Food": [
    "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍈", "🍒", "🍑",
    "🍕", "🍔", "🍟", "🌭", "🍿", "🧁", "🍰", "🎂", "🍪", "☕",
  ],
};

export function EmojiPicker({
  onEmojiSelect,
  side = "top",
  align = "start",
  className,
  triggerClassName,
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Smileys");

  const handleSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", triggerClassName)}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-80 p-0", className)}
        side={side}
        align={align}
      >
        {/* Category tabs */}
        <div className="flex gap-1 border-b p-2 overflow-x-auto">
          {Object.keys(EMOJI_CATEGORIES).map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs whitespace-nowrap"
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Emoji grid */}
        <ScrollArea className="h-48">
          <div className="grid grid-cols-8 gap-1 p-2">
            {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSelect(emoji)}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// Quick emoji picker for reactions (smaller, just common emojis)
export function QuickEmojiPicker({
  onEmojiSelect,
  side = "top",
  align = "start",
}: Omit<EmojiPickerProps, "className" | "triggerClassName">) {
  const [open, setOpen] = useState(false);
  
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

  const handleSelect = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side={side} align={align}>
        <div className="flex items-center gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className="h-8 w-8 rounded hover:bg-muted flex items-center justify-center text-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
