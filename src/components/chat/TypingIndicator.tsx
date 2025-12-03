import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; userName: string }>;
  className?: string;
}

export function TypingIndicator({ typingUsers, className }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].userName} is typing`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`;
    }
    return `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing`;
  };

  return (
    <div className={cn("flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground", className)}>
      <span>{getTypingText()}</span>
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </span>
    </div>
  );
}
