import { Copy, Edit2, Reply, Trash2, MoreHorizontal } from "lucide-react";
import { MessageWithProfile } from "@/types/chat";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useDeleteMessage } from "@/hooks/chat/useChatOperations";
import { toast } from "sonner";

interface MessageActionsProps {
  message: MessageWithProfile;
  isCurrentUser: boolean;
  channelId: string;
  onReply: () => void;
  onEdit: () => void;
}

export function MessageActions({ 
  message, 
  isCurrentUser, 
  channelId,
  onReply, 
  onEdit 
}: MessageActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteMessage = useDeleteMessage();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success("Message copied to clipboard");
    } catch {
      toast.error("Failed to copy message");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMessage.mutateAsync({ messageId: message.id, channelId });
      toast.success("Message deleted");
      setShowDeleteDialog(false);
    } catch {
      toast.error("Failed to delete message");
    }
  };

  // Don't show actions for deleted messages
  if (message.deleted_at) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isCurrentUser ? "end" : "start"}>
          <DropdownMenuItem onClick={onReply}>
            <Reply className="mr-2 h-4 w-4" />
            Reply
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Text
          </DropdownMenuItem>

          {isCurrentUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMessage.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
