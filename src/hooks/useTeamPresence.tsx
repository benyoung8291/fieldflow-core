import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "react-router-dom";

interface UserPresence {
  user_id: string;
  user_name: string;
  avatar_url?: string;
  current_page: string;
  current_path: string;
  document_id?: string;
  document_type?: string;
  online_at: string;
}

interface PresenceState {
  [key: string]: UserPresence[];
}

interface GroupedUserLocation {
  page: string;
  path: string;
  document_id?: string;
  document_type?: string;
}

export interface GroupedUser {
  user_id: string;
  user_name: string;
  avatar_url?: string;
  locations: GroupedUserLocation[];
  online_at: string;
}

const ROUTE_NAMES: { [key: string]: string } = {
  "/dashboard": "Dashboard",
  "/service-orders": "Service Orders",
  "/quotes": "Quotes",
  "/projects": "Projects",
  "/invoices": "Invoices",
  "/ap-invoices": "AP Invoices",
  "/scheduler": "Scheduler",
  "/appointments": "Appointments",
  "/customers": "Customers",
  "/customer-locations": "Customer Locations",
  "/workers": "Workers",
  "/tasks": "Tasks",
  "/leads": "Leads",
  "/contacts": "Contacts",
  "/suppliers": "Suppliers",
  "/purchase-orders": "Purchase Orders",
  "/expenses": "Expenses",
  "/service-contracts": "Service Contracts",
  "/field-reports": "Field Reports",
  "/timesheets": "Timesheets",
  "/settings": "Settings",
  "/helpdesk": "Help Desk",
  "/crm-hub": "CRM Hub",
};

export const useTeamPresence = () => {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const location = useLocation();
  const params = useParams();

  // Get current user info
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-presence"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", user.id)
        .single();

      return {
        id: user.id,
        name: profile
          ? `${profile.first_name} ${profile.last_name}`.trim() || user.email
          : user.email || "Unknown User",
        avatar_url: profile?.avatar_url,
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const getPageName = useCallback((path: string): string => {
    for (const [route, name] of Object.entries(ROUTE_NAMES)) {
      if (path.startsWith(route)) {
        return name;
      }
    }
    return "Viewing";
  }, []);

  const getDocumentInfo = useCallback((path: string, params: any) => {
    // Extract document type and ID from path
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length >= 2 && params.id) {
      const documentType = segments[0];
      return {
        document_id: params.id,
        document_type: documentType,
      };
    }
    
    return {};
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    console.log("[Team Presence] Initializing for user:", currentUser.name);

    const channel = supabase.channel("team-presence-global", {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state: PresenceState = channel.presenceState();
        const users: UserPresence[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key];
          if (presences && presences.length > 0) {
            presences.forEach((presence) => {
              users.push(presence);
            });
          }
        });

        console.log("[Team Presence] Synced users:", users.length, users);
        setActiveUsers(users);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("[Team Presence] User joined:", key, newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("[Team Presence] User left:", key, leftPresences);
      })
      .subscribe(async (status) => {
        console.log("[Team Presence] Subscription status:", status);
        if (status === "SUBSCRIBED") {
          updatePresence();
        }
      });

    const updatePresence = () => {
      const currentPath = location.pathname;
      const documentInfo = getDocumentInfo(currentPath, params);
      
      const presenceData = {
        user_id: currentUser.id,
        user_name: currentUser.name,
        avatar_url: currentUser.avatar_url,
        current_page: getPageName(currentPath),
        current_path: currentPath,
        ...documentInfo,
        online_at: new Date().toISOString(),
      };
      
      console.log("[Team Presence] Tracking presence:", presenceData);
      channel.track(presenceData);
    };

    // Update presence on location change
    updatePresence();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, location.pathname, params.id, getPageName, getDocumentInfo]);

  // Group users and deduplicate locations
  const groupedUsers: GroupedUser[] = activeUsers.reduce((acc, user) => {
    // Skip current user
    if (currentUser && user.user_id === currentUser.id) {
      return acc;
    }

    const existingUser = acc.find((u) => u.user_id === user.user_id);

    if (existingUser) {
      // Check if this exact location (path + document) is already tracked
      const locationExists = existingUser.locations.some(
        (l) =>
          l.path === user.current_path &&
          l.document_id === user.document_id
      );
      
      if (!locationExists) {
        existingUser.locations.push({
          page: user.current_page,
          path: user.current_path,
          document_id: user.document_id,
          document_type: user.document_type,
        });
      }
    } else {
      acc.push({
        user_id: user.user_id,
        user_name: user.user_name,
        avatar_url: user.avatar_url,
        locations: [
          {
            page: user.current_page,
            path: user.current_path,
            document_id: user.document_id,
            document_type: user.document_type,
          },
        ],
        online_at: user.online_at,
      });
    }

    return acc;
  }, [] as GroupedUser[]);

  return { activeUsers: groupedUsers };
};
