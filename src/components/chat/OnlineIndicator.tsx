import { cn } from "@/lib/utils";

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function OnlineIndicator({ isOnline, size = "sm", className }: OnlineIndicatorProps) {
  const sizeClasses = {
    xs: "h-1.5 w-1.5",
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
  };

  if (!isOnline) return null;

  return (
    <span
      className={cn(
        "rounded-full bg-slack-online ring-2 ring-background",
        sizeClasses[size],
        className
      )}
      title="Online"
    />
  );
}
