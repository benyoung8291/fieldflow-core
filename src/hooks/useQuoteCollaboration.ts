import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CollaboratorCursor {
  user_id: string;
  user_name: string;
  x: number;
  y: number;
  color: string;
}

interface FieldEditor {
  user_id: string;
  user_name: string;
  field_name: string;
  color: string;
}

interface FieldChange {
  user_id: string;
  user_name: string;
  field_name: string;
  field_value: string;
  timestamp: string;
}

/**
 * Hook for real-time collaboration on quotes
 * Broadcasts cursor positions, field focus, and field changes
 */
export function useQuoteCollaboration(quoteId: string | undefined) {
  const [collaborators, setCollaborators] = useState<CollaboratorCursor[]>([]);
  const [fieldEditors, setFieldEditors] = useState<FieldEditor[]>([]);
  const [recentChanges, setRecentChanges] = useState<FieldChange[]>([]);
  const channelRef = useRef<any>(null);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-collab"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      return {
        id: user.id,
        name: profile
          ? `${profile.first_name} ${profile.last_name}`.trim() || user.email
          : user.email || "Unknown User",
      };
    },
  });

  // Generate consistent user color based on user_id
  const getUserColor = (userId: string): string => {
    const colors = [
      "#ef4444", "#f59e0b", "#10b981", "#3b82f6", 
      "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  useEffect(() => {
    if (!quoteId || !currentUser) return;

    const channelName = `quote-collab:${quoteId}`;
    const channel = supabase.channel(channelName);

    // Handle cursor broadcasts
    channel.on("broadcast", { event: "cursor:move" }, (payload) => {
      const { user_id, user_name, x, y } = payload.payload;
      
      // Skip own cursor
      if (user_id === currentUser.id) return;

      setCollaborators((prev) => {
        const existing = prev.find((c) => c.user_id === user_id);
        const color = getUserColor(user_id);
        
        if (existing) {
          return prev.map((c) =>
            c.user_id === user_id ? { ...c, x, y } : c
          );
        } else {
          return [...prev, { user_id, user_name, x, y, color }];
        }
      });
    });

    // Handle field focus
    channel.on("broadcast", { event: "field:focus" }, (payload) => {
      const { user_id, user_name, field_name } = payload.payload;
      
      if (user_id === currentUser.id) return;

      setFieldEditors((prev) => {
        const existing = prev.find(
          (e) => e.user_id === user_id && e.field_name === field_name
        );
        if (existing) return prev;

        const color = getUserColor(user_id);
        return [...prev, { user_id, user_name, field_name, color }];
      });
    });

    // Handle field blur
    channel.on("broadcast", { event: "field:blur" }, (payload) => {
      const { user_id, field_name } = payload.payload;
      
      setFieldEditors((prev) =>
        prev.filter(
          (e) => !(e.user_id === user_id && e.field_name === field_name)
        )
      );
    });

    // Handle field changes
    channel.on("broadcast", { event: "field:change" }, (payload) => {
      const { user_id, user_name, field_name, field_value } = payload.payload;
      
      if (user_id === currentUser.id) return;

      setRecentChanges((prev) => [
        {
          user_id,
          user_name,
          field_name,
          field_value,
          timestamp: new Date().toISOString(),
        },
        ...prev.slice(0, 9), // Keep last 10 changes
      ]);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [quoteId, currentUser]);

  // Broadcast cursor movement
  const broadcastCursor = (x: number, y: number) => {
    if (!channelRef.current || !currentUser) return;

    channelRef.current.send({
      type: "broadcast",
      event: "cursor:move",
      payload: {
        user_id: currentUser.id,
        user_name: currentUser.name,
        x,
        y,
      },
    });
  };

  // Broadcast field focus
  const broadcastFieldFocus = (fieldName: string) => {
    if (!channelRef.current || !currentUser) return;

    channelRef.current.send({
      type: "broadcast",
      event: "field:focus",
      payload: {
        user_id: currentUser.id,
        user_name: currentUser.name,
        field_name: fieldName,
      },
    });
  };

  // Broadcast field blur
  const broadcastFieldBlur = (fieldName: string) => {
    if (!channelRef.current || !currentUser) return;

    channelRef.current.send({
      type: "broadcast",
      event: "field:blur",
      payload: {
        user_id: currentUser.id,
        field_name: fieldName,
      },
    });
  };

  // Broadcast field change
  const broadcastFieldChange = (fieldName: string, fieldValue: string) => {
    if (!channelRef.current || !currentUser) return;

    channelRef.current.send({
      type: "broadcast",
      event: "field:change",
      payload: {
        user_id: currentUser.id,
        user_name: currentUser.name,
        field_name: fieldName,
        field_value: fieldValue,
      },
    });
  };

  return {
    collaborators,
    fieldEditors,
    recentChanges,
    broadcastCursor,
    broadcastFieldFocus,
    broadcastFieldBlur,
    broadcastFieldChange,
    currentUser,
  };
}
