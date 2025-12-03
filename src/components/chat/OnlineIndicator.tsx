import { cn } from "@/lib/utils";

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function OnlineIndicator({ isOnline, size = "sm", className }: OnlineIndicatorProps) {
  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
  };

  if (!isOnline) return null;

  return (
    <span
      className={cn(
        "rounded-full bg-emerald-500 ring-2 ring-background",
        sizeClasses[size],
        className
      )}
      title="Online"
    />
  );
}
