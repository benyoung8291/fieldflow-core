import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PresenceUser {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  currentField?: string;
}

interface PresenceIndicatorProps {
  users: PresenceUser[];
  className?: string;
}

const avatarColors = [
  "bg-primary",
  "bg-success",
  "bg-warning",
  "bg-info",
  "bg-secondary",
  "bg-destructive",
];

function getAvatarColor(userId: string): string {
  const index = userId.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function PresenceIndicator({ users, className }: PresenceIndicatorProps) {
  if (users.length === 0) return null;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center -space-x-2", className)}>
        {users.slice(0, 5).map((user) => (
          <Tooltip key={user.userId}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className={cn(
                  "h-8 w-8 border-2 border-background cursor-pointer hover:z-10 transition-transform hover:scale-110",
                  !user.userAvatar && getAvatarColor(user.userId)
                )}>
                  {user.userAvatar ? (
                    <AvatarImage src={user.userAvatar} alt={user.userName} />
                  ) : (
                    <AvatarFallback className="text-xs text-white">
                      {getInitials(user.userName)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-success ring-2 ring-background" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{user.userName}</p>
              {user.currentField && (
                <p className="text-xs text-muted-foreground">Editing: {user.currentField}</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
        {users.length > 5 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center cursor-pointer hover:z-10">
                <span className="text-xs font-medium">+{users.length - 5}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{users.length - 5} more</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
