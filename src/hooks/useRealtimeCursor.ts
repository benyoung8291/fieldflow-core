import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

export interface CursorPosition {
  x: number;
  y: number;
  user_id: string;
  user_name: string;
  color: string;
  page_path: string;
  timestamp: number;
}

interface PresenceState {
  [key: string]: CursorPosition[];
}

const USER_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

let userColorMap: { [key: string]: string } = {};
let colorIndex = 0;

const getUserColor = (userId: string): string => {
  if (!userColorMap[userId]) {
    userColorMap[userId] = USER_COLORS[colorIndex % USER_COLORS.length];
    colorIndex++;
  }
  return userColorMap[userId];
};

export const useRealtimeCursor = (userName: string, userId: string) => {
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const location = useLocation();
  const currentPath = location.pathname;

  useEffect(() => {
    if (!userId || !userName) return;

    const channel = supabase.channel("cursor-tracking");
    let lastUpdateTime = 0;
    const THROTTLE_MS = 50; // Send updates max every 50ms

    const updateCursor = (x: number, y: number) => {
      const now = Date.now();
      if (now - lastUpdateTime < THROTTLE_MS) return;
      lastUpdateTime = now;

      channel.track({
        x,
        y,
        user_id: userId,
        user_name: userName,
        color: getUserColor(userId),
        page_path: currentPath,
        timestamp: now,
      });
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state: PresenceState = channel.presenceState();
        const allCursors: CursorPosition[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key];
          if (presences && presences.length > 0) {
            const cursor = presences[0];
            // Only show cursors on the same page
            if (cursor.page_path === currentPath && cursor.user_id !== userId) {
              allCursors.push(cursor);
            }
          }
        });

        setCursors(allCursors);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        console.log("User joined cursor tracking:", newPresences);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        console.log("User left cursor tracking:", leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track initial cursor position
          await channel.track({
            x: 0,
            y: 0,
            user_id: userId,
            user_name: userName,
            color: getUserColor(userId),
            page_path: currentPath,
            timestamp: Date.now(),
          });
        }
      });

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      if (!isEnabled) return;
      updateCursor(e.clientX, e.clientY);
    };

    // Add mouse move listener
    window.addEventListener("mousemove", handleMouseMove);

    // Update cursor when path changes
    updateCursor(0, 0);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      supabase.removeChannel(channel);
    };
  }, [userId, userName, currentPath, isEnabled]);

  return { cursors, isEnabled, setIsEnabled };
};
