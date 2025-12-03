import { useState } from "react";
import { format } from "date-fns";
import { MessageWithProfile } from "@/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { FileIcon, ImageIcon } from "lucide-react";

interface MessageBubbleProps {
  message: MessageWithProfile;
  isCurrentUser: boolean;
  isContinuous: boolean;
}

export function MessageBubble({ message, isCurrentUser, isContinuous }: MessageBubbleProps) {
  const [showTimestamp, setShowTimestamp] = useState(false);

  const senderName = message.profile
    ? `${message.profile.first_name || ""} ${message.profile.last_name || ""}`.trim() || "Unknown"
    : "Unknown";

  const initials = message.profile
    ? `${message.profile.first_name?.[0] || ""}${message.profile.last_name?.[0] || ""}`.toUpperCase() || "?"
    : "?";

  const isImage = (fileType: string | null) => {
    return fileType?.startsWith("image/");
  };

  return (
    <div
      className={cn(
        "group flex gap-2",
        isCurrentUser ? "flex-row-reverse" : "flex-row",
        isContinuous ? "mt-0.5" : "mt-3"
      )}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {/* Avatar - hidden if continuous */}
      <div className="w-8 flex-shrink-0">
        {!isContinuous && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={message.profile?.avatar_url || undefined} alt={senderName} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Message Content */}
      <div className={cn("flex max-w-[70%] flex-col", isCurrentUser ? "items-end" : "items-start")}>
        {/* Name - hidden if continuous */}
        {!isContinuous && !isCurrentUser && (
          <span className="mb-1 text-xs font-medium text-muted-foreground">{senderName}</span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "relative rounded-2xl px-3 py-2",
            isCurrentUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
            isContinuous && isCurrentUser && "rounded-tr-md",
            isContinuous && !isCurrentUser && "rounded-tl-md"
          )}
        >
          {/* Message Text */}
          <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>

          {/* Inline Timestamp */}
          <span
            className={cn(
              "mt-1 block text-right text-[10px] transition-opacity",
              isCurrentUser ? "text-primary-foreground/70" : "text-muted-foreground",
              showTimestamp ? "opacity-100" : "opacity-0"
            )}
          >
            {format(new Date(message.created_at), "h:mm a")}
          </span>
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-2", isCurrentUser ? "justify-end" : "justify-start")}>
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-2 rounded-lg border bg-background p-2 text-sm transition-colors hover:bg-accent",
                  isImage(attachment.file_type) ? "flex-col" : ""
                )}
              >
                {isImage(attachment.file_type) ? (
                  <img
                    src={attachment.file_url}
                    alt={attachment.file_name}
                    className="max-h-40 max-w-40 rounded-md object-cover"
                  />
                ) : (
                  <>
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-32 truncate text-xs">{attachment.file_name}</span>
                  </>
                )}
              </a>
            ))}
          </div>
        )}

        {/* Edited indicator */}
        {message.is_edited && (
          <span className="mt-0.5 text-[10px] text-muted-foreground">(edited)</span>
        )}
      </div>
    </div>
  );
}
