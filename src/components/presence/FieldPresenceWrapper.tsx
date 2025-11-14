import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PresenceUser {
  userId: string;
  userName: string;
  currentField?: string;
  isTyping?: boolean;
  typingInField?: string;
  color?: string; // Hex color from presence system
}

interface FieldPresenceWrapperProps {
  fieldName: string;
  children: ReactNode;
  onlineUsers: PresenceUser[];
  className?: string;
}

// Fallback colors if no color is provided
const fallbackColors = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
];

function getFallbackColor(userId: string) {
  const index = userId.charCodeAt(0) % fallbackColors.length;
  return fallbackColors[index];
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
  const typingUser = usersTypingInThisField[0];
  const typingUserColor = typingUser 
    ? (typingUser.color || getFallbackColor(typingUser.userId))
    : null;

  return (
    <div className={cn("relative", className)}>
      {/* Colored border glow when someone is typing */}
      {hasTypingUsers && typingUserColor && (
        <div
          className="absolute inset-0 pointer-events-none rounded-md transition-all duration-300"
          style={{
            boxShadow: `0 0 0 2px ${typingUserColor}, 0 0 12px ${typingUserColor}80, 0 0 24px ${typingUserColor}40`,
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
      )}
      
      {children}
      
      {/* Typing indicator - shown when user is actively typing */}
      {hasTypingUsers && (
        <div className="absolute -top-7 left-0 z-20">
          <Badge
            variant="outline"
            className="text-xs font-medium shadow-sm text-white border-0"
            style={{ 
              backgroundColor: typingUserColor || "#3B82F6",
            }}
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
            className="text-xs font-medium shadow-sm"
          >
            {usersEditingThisField.length === 1 
              ? usersEditingThisField[0].userName.split(" ")[0]
              : `${usersEditingThisField.length} users`
            }
          </Badge>
        </div>
      )}
    </div>
  );
}
