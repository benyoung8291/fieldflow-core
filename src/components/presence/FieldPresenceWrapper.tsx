import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PresenceUser {
  userId: string;
  userName: string;
  currentField?: string;
  isTyping?: boolean;
  typingInField?: string;
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

  const usersTypingInThisField = onlineUsers.filter(
    (user) => user.isTyping && user.typingInField === fieldName
  );

  const hasActiveUsers = usersEditingThisField.length > 0;
  const hasTypingUsers = usersTypingInThisField.length > 0;
  const primaryUser = usersEditingThisField[0];
  const typingUser = usersTypingInThisField[0];
  const colors = primaryUser ? getUserColor(primaryUser.userId) : userColors[0];
  const typingColors = typingUser ? getUserColor(typingUser.userId) : userColors[0];

  return (
    <div className={cn("relative", className)}>
      {children}
      
      {/* Typing indicator - shown when user is actively typing */}
      {hasTypingUsers && (
        <div className="absolute -top-7 left-0 z-20">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium shadow-sm",
              typingColors.border,
              typingColors.bg,
              typingColors.text
            )}
          >
            {usersTypingInThisField.length === 1 
              ? `${typingUser.userName.split(" ")[0]} is typing...`
              : `${usersTypingInThisField.length} users typing...`
            }
          </Badge>
        </div>
      )}

      {/* Viewing indicator - shown when user is viewing but not typing */}
      {hasActiveUsers && !hasTypingUsers && (
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
      
      {/* Border highlight */}
      {(hasActiveUsers || hasTypingUsers) && (
        <div
          className={cn(
            "absolute inset-0 pointer-events-none rounded-md border-2",
            hasTypingUsers ? "animate-pulse" : "",
            hasTypingUsers ? typingColors.border : colors.border
          )}
        />
      )}
    </div>
  );
}
