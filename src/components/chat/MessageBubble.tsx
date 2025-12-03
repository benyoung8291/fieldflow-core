import { useState } from "react";
import { format } from "date-fns";
import { MessageWithProfile } from "@/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { FileText, Download } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

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

  const isImage = (fileType: string | null) => fileType?.startsWith("image/");

  const imageAttachments = message.attachments?.filter((a) => isImage(a.file_type)) || [];
  const fileAttachments = message.attachments?.filter((a) => !isImage(a.file_type)) || [];

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
      {/* Avatar */}
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
        {/* Name */}
        {!isContinuous && !isCurrentUser && (
          <span className="mb-1 text-xs font-medium text-muted-foreground">{senderName}</span>
        )}

        {/* Text Bubble */}
        {message.content && (
          <div
            className={cn(
              "relative rounded-2xl px-3 py-2",
              isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              isContinuous && isCurrentUser && "rounded-tr-md",
              isContinuous && !isCurrentUser && "rounded-tl-md"
            )}
          >
            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
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
        )}

        {/* Image Attachments */}
        {imageAttachments.length > 0 && (
          <div
            className={cn(
              "mt-1 grid gap-1",
              imageAttachments.length === 1 ? "grid-cols-1" : "grid-cols-2",
              isCurrentUser ? "justify-items-end" : "justify-items-start"
            )}
          >
            {imageAttachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg border bg-muted transition-transform hover:scale-[1.02]"
              >
                <div className="w-48">
                  <AspectRatio ratio={4 / 3}>
                    <img
                      src={attachment.file_url}
                      alt={attachment.file_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </AspectRatio>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* File Attachments */}
        {fileAttachments.length > 0 && (
          <div className={cn("mt-1 flex flex-col gap-1", isCurrentUser ? "items-end" : "items-start")}>
            {fileAttachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={attachment.file_name}
                className="flex items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="max-w-40 truncate text-sm font-medium">
                    {attachment.file_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : "File"}
                  </span>
                </div>
                <Download className="h-4 w-4 text-muted-foreground" />
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
