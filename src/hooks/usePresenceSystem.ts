import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface PresenceData {
  user_id: string;
  user_name: string;
  current_page: string;
  current_path: string;
  document_id?: string | null;
  document_type?: string | null;
  online_at: string;
}

interface PresenceState {
  [key: string]: PresenceData[];
}

interface UsePresenceSystemOptions {
  trackPresence?: boolean;
  pageName?: string;
  documentId?: string | null;
  documentType?: string | null;
}

/**
 * Centralized presence system hook - manages all presence tracking
 * Built from first principles for reliability and consistency
 */
export function usePresenceSystem(options: UsePresenceSystemOptions = {}) {
  const { trackPresence = true, pageName, documentId, documentType } = options;
  const [onlineUsers, setOnlineUsers] = useState<PresenceData[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch current user with profile data
  const { data: currentUser } = useQuery({
    queryKey: ["presence-current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      const firstName = profile?.first_name?.trim() || "";
      const lastName = profile?.last_name?.trim() || "";
      const fullName = `${firstName} ${lastName}`.trim();

      return {
        id: user.id,
        name: fullName || user.email?.split("@")[0] || "User",
        email: user.email || "",
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get current page name
  const getCurrentPage = useCallback(() => {
    if (pageName) return pageName;

    const path = window.location.pathname;
    const routes: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/helpdesk": "Help Desk",
      "/service-orders": "Service Orders",
      "/quotes": "Quotes",
      "/projects": "Projects",
      "/invoices": "Invoices",
      "/customers": "Customers",
      "/workers": "Workers",
      "/tasks": "Tasks",
      "/leads": "Leads",
      "/settings": "Settings",
    };

    for (const [route, name] of Object.entries(routes)) {
      if (path.startsWith(route)) return name;
    }

    return "App";
  }, [pageName]);

  // Main presence effect
  useEffect(() => {
    if (!currentUser || !trackPresence) {
      console.log("[Presence] Not tracking - currentUser:", !!currentUser, "trackPresence:", trackPresence);
      return;
    }

    console.log("[Presence] Initializing for user:", currentUser.name, currentUser.id);
    const channelName = "team-presence-global";
    let heartbeatInterval: NodeJS.Timeout;
    let reconnectTimeout: NodeJS.Timeout;

    const presenceChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    // Handle presence sync - this is the source of truth for who's online
    presenceChannel.on("presence", { event: "sync" }, () => {
      const state: PresenceState = presenceChannel.presenceState();
      console.log("[Presence] Sync event - raw state:", state);
      const users: PresenceData[] = [];

      Object.keys(state).forEach((key) => {
        const presences = state[key];
        if (presences && presences.length > 0) {
          // Take the most recent presence data for each user
          const latestPresence = presences[presences.length - 1];
          
          // Ensure user_name is always set
          if (latestPresence.user_name) {
            users.push(latestPresence);
          } else {
            console.warn("[Presence] Skipping presence without user_name:", latestPresence);
          }
        }
      });

      console.log("[Presence] Total users found:", users.length);

      // Filter out current user and sort by online_at
      const otherUsers = users
        .filter((u) => u.user_id !== currentUser.id)
        .sort((a, b) => 
          new Date(b.online_at).getTime() - new Date(a.online_at).getTime()
        );

      console.log("[Presence] Online users (excluding self):", otherUsers.length, otherUsers);
      setOnlineUsers(otherUsers);
    });

    // Log join events
    presenceChannel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      console.log("[Presence] User joined:", key, newPresences);
    });

    // Log leave events
    presenceChannel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      console.log("[Presence] User left:", key, leftPresences);
    });

    // Track initial presence
    const trackUserPresence = async () => {
      const currentPath = window.location.pathname + window.location.search;
      const presenceData: PresenceData = {
        user_id: currentUser.id,
        user_name: currentUser.name,
        current_page: getCurrentPage(),
        current_path: currentPath,
        document_id: documentId || null,
        document_type: documentType || null,
        online_at: new Date().toISOString(),
      };

      await presenceChannel.track(presenceData);
    };

    // Subscribe and track presence
    presenceChannel.subscribe(async (status) => {
      console.log("[Presence] Channel status:", status);
      
      if (status === "SUBSCRIBED") {
        setIsConnected(true);
        console.log("[Presence] Successfully subscribed, tracking presence...");
        await trackUserPresence();

        // Send heartbeat every 30 seconds to keep presence alive
        heartbeatInterval = setInterval(async () => {
          try {
            console.log("[Presence] Sending heartbeat...");
            await trackUserPresence();
          } catch (error) {
            console.error("[Presence] Heartbeat failed:", error);
          }
        }, 30000);
      } else if (status === "CHANNEL_ERROR") {
        console.error("[Presence] Channel error, will retry in 5s");
        setIsConnected(false);
        // Attempt to reconnect after 5 seconds
        reconnectTimeout = setTimeout(() => {
          console.log("[Presence] Attempting to reconnect...");
          presenceChannel.subscribe();
        }, 5000);
      }
    });

    // Update presence when page/document changes
    const updatePresence = async () => {
      if (isConnected) {
        await trackUserPresence();
      }
    };

    // Listen for route changes
    const handleRouteChange = () => {
      updatePresence();
    };

    window.addEventListener("popstate", handleRouteChange);

    // Cleanup
    return () => {
      console.log("[Presence] Cleaning up presence channel");
      window.removeEventListener("popstate", handleRouteChange);
      clearInterval(heartbeatInterval);
      clearTimeout(reconnectTimeout);
      supabase.removeChannel(presenceChannel);
      setIsConnected(false);
    };
  }, [currentUser, trackPresence, getCurrentPage, documentId, documentType]); // Removed isConnected from deps to prevent re-subscription loops

  return {
    onlineUsers,
    currentUser,
    isConnected,
    onlineCount: onlineUsers.length,
  };
}
