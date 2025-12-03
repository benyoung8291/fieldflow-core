import { cn } from "@/lib/utils";

interface UnreadDividerProps {
  className?: string;
}

export function UnreadDivider({ className }: UnreadDividerProps) {
  return (
    <div className={cn("my-4 flex items-center gap-3", className)}>
      <div className="flex-1 h-px bg-destructive/50" />
      <span className="text-xs font-medium text-destructive px-2">
        New Messages
      </span>
      <div className="flex-1 h-px bg-destructive/50" />
    </div>
  );
}
