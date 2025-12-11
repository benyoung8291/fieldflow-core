import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕'],
  'Gestures': ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '🤙', '👋', '✋', '🖐️', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '🤏', '👈', '👉', '👆', '👇', '☝️', '👊', '✊', '🤛', '🤜'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Business': ['✅', '❌', '⚠️', '📌', '📎', '📧', '📞', '🗓️', '⏰', '🎉', '🔥', '⭐', '💯', '✨', '🚀', '💼', '📊', '📈', '📉', '💡', '🔔', '📝', '📋', '📁', '🗂️', '📂', '🔗', '🔍'],
};

interface EditorEmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

export const EditorEmojiPicker = ({ onEmojiSelect, className }: EditorEmojiPickerProps) => {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('Smileys');

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
          className={cn("h-8 w-8", className)}
          title="Insert emoji"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="top">
        {/* Category Tabs */}
        <div className="flex border-b overflow-x-auto">
          {Object.keys(EMOJI_CATEGORIES).map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category as keyof typeof EMOJI_CATEGORIES)}
              className={cn(
                "px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                activeCategory === category 
                  ? "border-b-2 border-primary text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Emoji Grid */}
        <div className="p-2 max-h-48 overflow-y-auto">
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJI_CATEGORIES[activeCategory].map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleSelect(emoji)}
                className="h-8 w-8 text-lg flex items-center justify-center hover:bg-accent rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
