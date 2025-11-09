import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PresenceUser {
  userId: string;
  userName: string;
  currentField?: string;
}

interface FieldPresenceWrapperProps {
  fieldName: string;
  children: ReactNode;
  onlineUsers: PresenceUser[];
  className?: string;
}

const userColors = [
  { border: "border-primary", bg: "bg-primary/10", text: "text-primary" },
  { border: "border-success", bg: "bg-success/10", text: "text-success" },
  { border: "border-warning", bg: "bg-warning/10", text: "text-warning" },
  { border: "border-info", bg: "bg-info/10", text: "text-info" },
  { border: "border-secondary", bg: "bg-secondary/10", text: "text-secondary" },
];

function getUserColor(userId: string) {
  const index = userId.charCodeAt(0) % userColors.length;
  return userColors[index];
}

export default function FieldPresenceWrapper({
  fieldName,
  children,
  onlineUsers,
  className,
}: FieldPresenceWrapperProps) {
  const usersEditingThisField = onlineUsers.filter(
    (user) => user.currentField === fieldName
  );

  const hasActiveUsers = usersEditingThisField.length > 0;
  const primaryUser = usersEditingThisField[0];
  const colors = primaryUser ? getUserColor(primaryUser.userId) : userColors[0];

  return (
    <div className={cn("relative", className)}>
      {children}
      {hasActiveUsers && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium shadow-sm animate-pulse",
              colors.border,
              colors.bg,
              colors.text
            )}
          >
            {usersEditingThisField.length === 1 
              ? primaryUser.userName.split(" ")[0]
              : `${usersEditingThisField.length} users`
            }
          </Badge>
        </div>
      )}
      {hasActiveUsers && (
        <div
          className={cn(
            "absolute inset-0 pointer-events-none rounded-md border-2 animate-pulse",
            colors.border
          )}
        />
      )}
    </div>
  );
}
