import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatChannelType } from "@/types/chat";

interface AttachmentInput {
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
}

interface SendMessageParams {
  channelId: string;
  content: string;
  replyToId?: string;
  attachments?: AttachmentInput[];
}

interface CreateChannelParams {
  name: string;
  type: ChatChannelType;
  description?: string;
  contextId?: string;
  contextType?: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, content, replyToId, attachments }: SendMessageParams) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Create message
      const { data: message, error: messageError } = await supabase
        .from("chat_messages")
        .insert({
          channel_id: channelId,
          user_id: user.user.id,
          tenant_id: profile.tenant_id,
          content,
          reply_to_id: replyToId || null,
        })
        .select()
        .single();

      if (messageError) {
        console.error("[Chat] Error sending message:", messageError);
        throw messageError;
      }

      // Create attachments if any
      if (attachments && attachments.length > 0) {
        const attachmentRecords = attachments.map((att) => ({
          message_id: message.id,
          tenant_id: profile.tenant_id,
          file_name: att.file_name,
          file_url: att.file_url,
          file_type: att.file_type,
          file_size: att.file_size,
        }));

        const { error: attachmentError } = await supabase
          .from("chat_attachments")
          .insert(attachmentRecords);

        if (attachmentError) {
          console.error("[Chat] Error creating attachments:", attachmentError);
          // Don't throw - message was sent, just log attachment failure
        }
      }

      return message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", variables.channelId] });
      queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
    },
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, type, description, contextId, contextType }: CreateChannelParams) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { data: channel, error: channelError } = await supabase
        .from("chat_channels")
        .insert({
          name,
          type,
          description: description || null,
          context_id: contextId || null,
          context_type: contextType || null,
          created_by: user.user.id,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (channelError) {
        console.error("[Chat] Error creating channel:", channelError);
        throw channelError;
      }

      const { error: memberError } = await supabase
        .from("chat_channel_members")
        .insert({
          channel_id: channel.id,
          user_id: user.user.id,
          tenant_id: profile.tenant_id,
          role: "owner",
        });

      if (memberError) {
        console.error("[Chat] Error adding creator as member:", memberError);
        throw memberError;
      }

      return channel;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
      if (variables.contextType && variables.contextId) {
        queryClient.invalidateQueries({
          queryKey: ["context-chat-channel", variables.contextType, variables.contextId],
        });
      }
    },
  });
}

export function useJoinChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { data, error } = await supabase
        .from("chat_channel_members")
        .insert({
          channel_id: channelId,
          user_id: user.user.id,
          tenant_id: profile.tenant_id,
          role: "member",
        })
        .select()
        .single();

      if (error) {
        console.error("[Chat] Error joining channel:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, channelId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
      queryClient.invalidateQueries({ queryKey: ["chat-channel-members", channelId] });
    },
  });
}

export function useLeaveChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("chat_channel_members")
        .delete()
        .eq("channel_id", channelId)
        .eq("user_id", user.user.id);

      if (error) {
        console.error("[Chat] Error leaving channel:", error);
        throw error;
      }
    },
    onSuccess: (_, channelId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
      queryClient.invalidateQueries({ queryKey: ["chat-channel-members", channelId] });
    },
  });
}

export function useUpdateLastRead() {
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("chat_channel_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("user_id", user.user.id);

      if (error) {
        console.error("[Chat] Error updating last read:", error);
        throw error;
      }
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const { data, error } = await supabase
        .from("chat_messages")
        .update({ content, is_edited: true })
        .eq("id", messageId)
        .select()
        .single();

      if (error) {
        console.error("[Chat] Error editing message:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", data.channel_id] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, channelId }: { messageId: string; channelId: string }) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId);

      if (error) {
        console.error("[Chat] Error deleting message:", error);
        throw error;
      }

      return { messageId, channelId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", data.channelId] });
    },
  });
}

export function useAddReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, channelId }: { messageId: string; emoji: string; channelId: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { data, error } = await supabase
        .from("chat_reactions")
        .insert({
          message_id: messageId,
          user_id: user.user.id,
          tenant_id: profile.tenant_id,
          emoji,
        })
        .select()
        .single();

      if (error) {
        console.error("[Chat] Error adding reaction:", error);
        throw error;
      }

      return { ...data, channelId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", data.channelId] });
    },
  });
}

export function useRemoveReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reactionId, channelId }: { reactionId: string; channelId: string }) => {
      const { error } = await supabase
        .from("chat_reactions")
        .delete()
        .eq("id", reactionId);

      if (error) {
        console.error("[Chat] Error removing reaction:", error);
        throw error;
      }

      return { channelId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", data.channelId] });
    },
  });
}

export function useToggleReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, channelId }: { messageId: string; emoji: string; channelId: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Check if user already has this reaction
      const { data: existingReaction } = await supabase
        .from("chat_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", user.user.id)
        .eq("emoji", emoji)
        .single();

      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from("chat_reactions")
          .delete()
          .eq("id", existingReaction.id);

        if (error) throw error;
        return { action: "removed" as const, channelId };
      } else {
        // Add reaction
        const { error } = await supabase
          .from("chat_reactions")
          .insert({
            message_id: messageId,
            user_id: user.user.id,
            tenant_id: profile.tenant_id,
            emoji,
          });

        if (error) throw error;
        return { action: "added" as const, channelId };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", data.channelId] });
    },
  });
}
