import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

export interface CursorPosition {
  x: number; // percentage of viewport width (0-100)
  y: number; // percentage of viewport height (0-100)
  user_id: string;
  user_name: string;
  color: string;
  page_path: string;
  timestamp: number;
}

export interface ClickPosition {
  x: number;
  y: number;
  user_id: string;
  user_name: string;
  color: string;
  timestamp: number;
  id: string;
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
  const [clicks, setClicks] = useState<ClickPosition[]>([]);
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

      // Convert absolute pixels to viewport percentages
      const xPercent = (x / window.innerWidth) * 100;
      const yPercent = (y / window.innerHeight) * 100;

      channel.track({
        x: xPercent,
        y: yPercent,
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
          // Track initial cursor position (center of viewport)
          await channel.track({
            x: 50,
            y: 50,
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

    // Mouse move listener
    window.addEventListener("mousemove", handleMouseMove);

    // Click listener
    const handleClick = (e: MouseEvent) => {
      if (!isEnabled) return;
      
      // Convert absolute pixels to viewport percentages
      const xPercent = (e.clientX / window.innerWidth) * 100;
      const yPercent = (e.clientY / window.innerHeight) * 100;
      
      const clickData = {
        type: "click" as const,
        x: xPercent,
        y: yPercent,
        user_id: userId,
        user_name: userName,
        color: getUserColor(userId),
        page_path: currentPath,
        timestamp: Date.now(),
        id: `${userId}-${Date.now()}`,
      };

      // Broadcast click event
      channel.send({
        type: "broadcast",
        event: "click",
        payload: clickData,
      });
    };

    window.addEventListener("click", handleClick);

    // Listen for click broadcasts
    const clickChannel = supabase.channel("click-events");
    clickChannel
      .on("broadcast", { event: "click" }, ({ payload }) => {
        if (payload.user_id !== userId && payload.page_path === currentPath) {
          setClicks((prev) => [...prev, payload]);
          // Remove click after animation duration
          setTimeout(() => {
            setClicks((prev) => prev.filter((c) => c.id !== payload.id));
          }, 1000);
        }
      })
      .subscribe();

    // Update cursor when path changes
    updateCursor(0, 0);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      supabase.removeChannel(channel);
      supabase.removeChannel(clickChannel);
    };
  }, [userId, userName, currentPath, isEnabled]);

  return { cursors, clicks, isEnabled, setIsEnabled };
};
