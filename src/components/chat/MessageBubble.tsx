import { format } from "date-fns";
import { MessageWithProfile } from "@/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { FileText, Download, CornerDownRight } from "lucide-react";
import { MessageReactions } from "./MessageReactions";
import { MessageActions } from "./MessageActions";

interface MessageBubbleProps {
  message: MessageWithProfile;
  isCurrentUser: boolean;
  isContinuous: boolean;
  currentUserId: string;
  channelId: string;
  onReply?: (message: MessageWithProfile) => void;
  onEdit?: (message: MessageWithProfile) => void;
  onScrollToMessage?: (messageId: string) => void;
  onImageClick?: (images: Array<{ url: string; name: string }>, index: number) => void;
}

export function MessageBubble({ 
  message, 
  isCurrentUser, 
  isContinuous, 
  currentUserId, 
  channelId,
  onReply,
  onEdit,
  onScrollToMessage,
  onImageClick,
}: MessageBubbleProps) {
  const senderName = message.profile
    ? `${message.profile.first_name || ""} ${message.profile.last_name || ""}`.trim() || "Unknown"
    : "Unknown";

  const initials = message.profile
    ? `${message.profile.first_name?.[0] || ""}${message.profile.last_name?.[0] || ""}`.toUpperCase() || "?"
    : "?";

  const isDeleted = !!message.deleted_at;
  const isImage = (fileType: string | null) => fileType?.startsWith("image/");
  const imageAttachments = message.attachments?.filter((a) => isImage(a.file_type)) || [];
  const fileAttachments = message.attachments?.filter((a) => !isImage(a.file_type)) || [];

  const replyToMessage = message.reply_to;
  const replyToSenderName = replyToMessage?.profile
    ? `${replyToMessage.profile.first_name || ""} ${replyToMessage.profile.last_name || ""}`.trim() || "Unknown"
    : "Unknown";

  const handleReplyClick = () => {
    if (replyToMessage && onScrollToMessage) {
      onScrollToMessage(replyToMessage.id);
    }
  };

  // Render deleted message - Slack style
  if (isDeleted) {
    return (
      <div
        className={cn(
          "group relative flex px-5 py-1 hover:bg-muted/30",
          isContinuous ? "mt-0" : "mt-4"
        )}
        id={`message-${message.id}`}
      >
        {/* Avatar column - always 36px width */}
        <div className="w-9 flex-shrink-0 mr-2">
          {!isContinuous && (
            <Avatar className="h-9 w-9">
              <AvatarImage src={message.profile?.avatar_url || undefined} alt={senderName} />
              <AvatarFallback className="text-xs bg-muted text-muted-foreground">{initials}</AvatarFallback>
            </Avatar>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {!isContinuous && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="font-bold text-sm text-muted-foreground">{senderName}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(message.created_at), "h:mm a")}
              </span>
            </div>
          )}
          <p className="text-sm italic text-muted-foreground">This message was deleted</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex px-5 py-1 hover:bg-muted/30 transition-colors",
        isContinuous ? "mt-0" : "mt-4"
      )}
      id={`message-${message.id}`}
    >
      {/* Hover timestamp for continuous messages */}
      {isContinuous && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {format(new Date(message.created_at), "h:mm")}
        </span>
      )}

      {/* Avatar column */}
      <div className="w-9 flex-shrink-0 mr-2">
        {!isContinuous && (
          <Avatar className="h-9 w-9">
            <AvatarImage src={message.profile?.avatar_url || undefined} alt={senderName} />
            <AvatarFallback className="text-xs bg-slack-avatar text-slack-avatar-foreground">{initials}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + Timestamp row (only for first message in group) */}
        {!isContinuous && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-bold text-sm text-foreground hover:underline cursor-pointer">
              {senderName}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(message.created_at), "h:mm a")}
            </span>
            {message.is_edited && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
          </div>
        )}

        {/* Reply Context - Slack style */}
        {replyToMessage && (
          <button
            onClick={handleReplyClick}
            className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <CornerDownRight className="h-3 w-3 flex-shrink-0" />
            <Avatar className="h-4 w-4">
              <AvatarImage src={replyToMessage.profile?.avatar_url || undefined} />
              <AvatarFallback className="text-[8px]">
                {replyToMessage.profile?.first_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{replyToSenderName}</span>
            <span className="truncate max-w-[200px]">
              {replyToMessage.deleted_at ? "This message was deleted" : replyToMessage.content}
            </span>
          </button>
        )}

        {/* Message text */}
        {message.content && (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
            {isContinuous && message.is_edited && (
              <span className="ml-1 text-xs text-muted-foreground">(edited)</span>
            )}
          </p>
        )}

        {/* Image Attachments - Slack style grid */}
        {imageAttachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {imageAttachments.map((attachment, idx) => (
              <button
                key={attachment.id}
                onClick={() => {
                  if (onImageClick) {
                    const images = imageAttachments.map((a) => ({
                      url: a.file_url,
                      name: a.file_name,
                    }));
                    onImageClick(images, idx);
                  }
                }}
                className="block overflow-hidden rounded-lg border border-border/50 transition-all hover:shadow-md cursor-pointer max-w-xs"
              >
                <img
                  src={attachment.file_url}
                  alt={attachment.file_name}
                  className="max-h-[300px] w-auto object-contain"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {/* File Attachments - Slack style */}
        {fileAttachments.length > 0 && (
          <div className="mt-1 flex flex-col gap-1">
            {fileAttachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={attachment.file_name}
                className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50 max-w-sm"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-medium text-primary">
                    {attachment.file_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : "File"}
                  </span>
                </div>
                <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </a>
            ))}
          </div>
        )}

        {/* Reactions - Slack style pills */}
        <MessageReactions
          messageId={message.id}
          channelId={channelId}
          reactions={message.reactions || []}
          currentUserId={currentUserId}
          isCurrentUser={isCurrentUser}
        />
      </div>

      {/* Floating action bar - appears on hover */}
      <div className="absolute right-4 -top-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <MessageActions
          message={message}
          isCurrentUser={isCurrentUser}
          channelId={channelId}
          onReply={() => onReply?.(message)}
          onEdit={() => onEdit?.(message)}
        />
      </div>
    </div>
  );
}
