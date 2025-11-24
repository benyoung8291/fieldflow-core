import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTeamPresence } from "@/hooks/useTeamPresence";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatDocumentLabel = (location: any) => {
  if (!location.document_id) {
    return location.page;
  }
  
  // Shorten document ID for display
  const shortId = location.document_id.slice(0, 8);
  return `${location.page} #${shortId}`;
};

export const TeamPresence = () => {
  const [open, setOpen] = useState(false);
  const { activeUsers } = useTeamPresence();
  const navigate = useNavigate();

  const totalCount = activeUsers.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative"
        >
          <Users className="h-5 w-5" />
          {totalCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full"
            >
              {totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 overflow-hidden"
        sideOffset={8}
      >
        <div className="bg-muted/50 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Team Activity</h3>
            <Badge variant="secondary" className="text-xs">
              {totalCount} online
            </Badge>
          </div>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          <div className="p-2 space-y-1">
            {activeUsers.map((user) => (
              <div
                key={user.user_id}
                className="group rounded-lg hover:bg-muted/50 transition-colors p-2"
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-9 w-9 ring-2 ring-background">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getInitials(user.user_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate mb-1">
                      {user.user_name}
                    </p>
                    <div className="space-y-1">
                      {user.locations.map((location, index) => (
                        <button
                          key={`${location.path}-${location.document_id || index}`}
                          onClick={() => {
                            navigate(location.path);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 text-xs text-muted-foreground",
                            "hover:text-primary transition-colors w-full text-left",
                            "rounded px-2 py-1 hover:bg-muted/80"
                          )}
                        >
                          <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                          <span className="truncate">
                            {formatDocumentLabel(location)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
