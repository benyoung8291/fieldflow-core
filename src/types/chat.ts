import { Database } from "@/integrations/supabase/types";

export type ChatChannelType = Database["public"]["Enums"]["chat_channel_type"];
export type ChatMemberRole = Database["public"]["Enums"]["chat_member_role"];

export interface ChatChannel {
  id: string;
  tenant_id: string;
  name: string | null;
  type: ChatChannelType;
  description: string | null;
  context_id: string | null;
  context_type: string | null;
  created_by: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  channel_id: string;
  user_id: string;
  tenant_id: string;
  role: ChatMemberRole;
  last_read_at: string;
  notifications_enabled: boolean;
  created_at: string;
}

export interface ChatAttachment {
  id: string;
  message_id: string;
  tenant_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  tenant_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  tenant_id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  is_edited: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface MessageWithProfile extends ChatMessage {
  profile: UserProfile | null;
  attachments: ChatAttachment[];
  reactions: ChatReaction[];
  reply_to?: MessageWithProfile | null;
}

export interface ChannelWithDetails extends ChatChannel {
  member_count?: number;
  unread_count?: number;
}
