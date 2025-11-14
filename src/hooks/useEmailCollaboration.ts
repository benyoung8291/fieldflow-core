import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CollaboratorPresence {
  userId: string;
  userName: string;
  isTyping: boolean;
  ticketId: string;
}

export const useEmailCollaboration = (ticketId: string) => {
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      if (!currentUser) return null;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", currentUser.id)
        .single();
      return data;
    },
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (!ticketId || !currentUser || !profile) return;

    const channel = supabase.channel(`email-collab-${ticketId}`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const collabs: CollaboratorPresence[] = [];
        
        Object.keys(state).forEach((userId) => {
          const presences = state[userId] as any[];
          if (presences.length > 0 && userId !== currentUser.id) {
            const presence = presences[0];
            collabs.push({
              userId,
              userName: presence.userName,
              isTyping: presence.isTyping || false,
              ticketId: presence.ticketId,
            });
          }
        });
        
        setCollaborators(collabs);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: currentUser.id,
            userName: `${profile.first_name} ${profile.last_name}`,
            isTyping: false,
            ticketId,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, currentUser, profile]);

  const updateTypingStatus = async (typing: boolean) => {
    if (!currentUser || !profile || isTyping === typing) return;
    
    setIsTyping(typing);
    
    const channel = supabase.channel(`email-collab-${ticketId}`);
    await channel.track({
      userId: currentUser.id,
      userName: `${profile.first_name} ${profile.last_name}`,
      isTyping: typing,
      ticketId,
    });
  };

  const typingUsers = collaborators.filter(c => c.isTyping);

  return {
    collaborators,
    typingUsers,
    updateTypingStatus,
  };
};
