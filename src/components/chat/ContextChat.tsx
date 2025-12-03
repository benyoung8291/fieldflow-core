import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateChannel } from "@/hooks/chat/useChatOperations";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatChannelView } from "./ChatChannelView";

interface ContextChatProps {
  contextType: "project" | "service_order";
  contextId: string;
  title: string;
}

export function ContextChat({ contextType, contextId, title }: ContextChatProps) {
  const { toast } = useToast();
  const createChannel = useCreateChannel();

  // Query to find existing channel for this context
  const { data: channel, isLoading, refetch } = useQuery({
    queryKey: ["context-chat-channel", contextType, contextId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("context_type", contextType)
        .eq("context_id", contextId)
        .maybeSingle();

      if (error) {
        console.error("[ContextChat] Error fetching channel:", error);
        throw error;
      }

      return data;
    },
    enabled: !!contextId,
  });

  const handleCreateChat = async () => {
    try {
      await createChannel.mutateAsync({
        name: title,
        type: "context",
        description: `Chat for ${contextType.replace("_", " ")}: ${title}`,
        contextType,
        contextId,
      });
      
      toast({ title: "Chat created successfully" });
      refetch();
    } catch (error: any) {
      toast({
        title: "Failed to create chat",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-280px)] border rounded-lg bg-background">
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="h-5 w-5" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-16 w-64 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No channel found - show create button
  if (!channel) {
    return (
      <div className="h-[calc(100vh-280px)] border rounded-lg bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No chat yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Start a conversation about this {contextType.replace("_", " ")} to collaborate with your team.
        </p>
        <Button
          onClick={handleCreateChat}
          disabled={createChannel.isPending}
        >
          <Plus className="h-4 w-4 mr-2" />
          {createChannel.isPending ? "Creating..." : "Create Chat"}
        </Button>
      </div>
    );
  }

  // Channel exists - render chat view
  return (
    <div className="h-[calc(100vh-280px)] border rounded-lg bg-background overflow-hidden">
      <ChatChannelView channelId={channel.id} />
    </div>
  );
}
