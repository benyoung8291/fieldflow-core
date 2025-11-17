import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

export interface CursorPosition {
  x: number; // percentage of document width (0-100)
  y: number; // percentage of document height (0-100)
  scrollX: number; // scroll position X
  scrollY: number; // scroll position Y
  viewportWidth: number; // viewport width for normalization
  viewportHeight: number; // viewport height for normalization
  zoom: number; // browser zoom level (1 = 100%)
  // Element anchoring (when hovering over interactive elements)
  elementId?: string; // stable element identifier
  elementX?: number; // X position relative to element (0-100%)
  elementY?: number; // Y position relative to element (0-100%)
  elementType?: string; // type of element (button, input, etc.)
  // Text selection
  selection?: {
    text: string;
    rects: Array<{ top: number; left: number; width: number; height: number }>;
  };
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
    const THROTTLE_MS = 500; // Send updates max every 500ms (much less frequent)

    // Get browser zoom level
    const getZoomLevel = (): number => {
      return window.devicePixelRatio || 1;
    };

    // Get document dimensions
    const getDocumentDimensions = () => {
      const body = document.body;
      const html = document.documentElement;
      
      const width = Math.max(
        body.scrollWidth,
        body.offsetWidth,
        html.clientWidth,
        html.scrollWidth,
        html.offsetWidth
      );
      
      const height = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );
      
      return { width, height };
    };

    // Generate stable element identifier
    const generateElementId = (element: Element): string => {
      // Try to use existing ID
      if (element.id) return `id:${element.id}`;
      
      // Build path using data attributes, classes, and tag names
      const parts: string[] = [];
      let current: Element | null = element;
      let depth = 0;
      
      while (current && depth < 5) {
        const tag = current.tagName.toLowerCase();
        const dataId = current.getAttribute('data-element-id');
        const ariaLabel = current.getAttribute('aria-label');
        
        if (dataId) {
          parts.unshift(`[data-id="${dataId}"]`);
          break;
        } else if (ariaLabel) {
          parts.unshift(`${tag}[aria="${ariaLabel}"]`);
          break;
        } else {
          // Use first unique class if available
          const classes = Array.from(current.classList);
          const uniqueClass = classes.find(c => 
            !c.startsWith('hover:') && 
            !c.startsWith('focus:') &&
            !c.includes('transition')
          );
          
          if (uniqueClass) {
            parts.unshift(`${tag}.${uniqueClass}`);
          } else {
            parts.unshift(tag);
          }
        }
        
        current = current.parentElement;
        depth++;
      }
      
      return parts.join('>');
    };

    // Find element by generated ID
    const findElementById = (elementId: string): Element | null => {
      if (elementId.startsWith('id:')) {
        return document.getElementById(elementId.substring(3));
      }
      
      try {
        return document.querySelector(elementId);
      } catch {
        return null;
      }
    };

    // Check if element is interactive
    const isInteractiveElement = (element: Element): boolean => {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      
      return (
        tag === 'button' ||
        tag === 'input' ||
        tag === 'select' ||
        tag === 'textarea' ||
        tag === 'a' ||
        role === 'button' ||
        role === 'link' ||
        element.classList.contains('cursor-pointer') ||
        element.hasAttribute('data-anchor-cursor')
      );
    };

    const updateCursor = (x: number, y: number, event?: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateTime < THROTTLE_MS) return;
      lastUpdateTime = now;

      // Get scroll position
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      // Get document dimensions
      const docDimensions = getDocumentDimensions();
      
      // Convert to document coordinates (accounting for scroll)
      const docX = x + scrollX;
      const docY = y + scrollY;
      
      // Convert to normalized percentages relative to document size
      const xPercent = (docX / docDimensions.width) * 100;
      const yPercent = (docY / docDimensions.height) * 100;

      // Check for element anchoring
      let elementData: {
        elementId?: string;
        elementX?: number;
        elementY?: number;
        elementType?: string;
      } = {};

      if (event?.target instanceof Element) {
        let target = event.target;
        
        // Walk up the tree to find an interactive element
        let depth = 0;
        while (target && depth < 5) {
          if (isInteractiveElement(target)) {
            const rect = target.getBoundingClientRect();
            
            // Calculate position relative to element (0-100%)
            const relX = ((x - rect.left) / rect.width) * 100;
            const relY = ((y - rect.top) / rect.height) * 100;
            
            elementData = {
              elementId: generateElementId(target),
              elementX: Math.max(0, Math.min(100, relX)),
              elementY: Math.max(0, Math.min(100, relY)),
              elementType: target.tagName.toLowerCase(),
            };
            break;
          }
          
          target = target.parentElement;
          depth++;
        }
      }

      channel.track({
        x: xPercent,
        y: yPercent,
        scrollX,
        scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        zoom: getZoomLevel(),
        ...elementData,
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
          const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
          const scrollY = window.pageYOffset || document.documentElement.scrollTop;
          
          await channel.track({
            x: 50,
            y: 50,
            scrollX,
            scrollY,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            zoom: window.devicePixelRatio || 1,
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
      updateCursor(e.clientX, e.clientY, e);
    };

    // Mouse move listener
    window.addEventListener("mousemove", handleMouseMove);

    // Selection change listener
    let selectionTimeout: NodeJS.Timeout;
    const handleSelectionChange = () => {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        if (!isEnabled) return;
        
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          // No selection, broadcast empty
          channel.send({
            type: "broadcast",
            event: "selection",
            payload: {
              user_id: userId,
              user_name: userName,
              color: getUserColor(userId),
              page_path: currentPath,
              selection: null,
              timestamp: Date.now(),
            },
          });
          return;
        }

        const range = selection.getRangeAt(0);
        const rects = Array.from(range.getClientRects()).map(rect => ({
          top: rect.top + (window.pageYOffset || document.documentElement.scrollTop),
          left: rect.left + (window.pageXOffset || document.documentElement.scrollLeft),
          width: rect.width,
          height: rect.height,
        }));

        // Broadcast selection
        channel.send({
          type: "broadcast",
          event: "selection",
          payload: {
            user_id: userId,
            user_name: userName,
            color: getUserColor(userId),
            page_path: currentPath,
            selection: {
              text: selection.toString(),
              rects,
            },
            timestamp: Date.now(),
          },
        });
      }, 150); // Debounce selection changes
    };

    document.addEventListener("selectionchange", handleSelectionChange);

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
      .on("broadcast", { event: "selection" }, ({ payload }) => {
        if (payload.user_id !== userId && payload.page_path === currentPath) {
          setCursors((prev) => {
            const otherCursors = prev.filter((c) => c.user_id !== payload.user_id);
            if (payload.selection) {
              // Find existing cursor and update with selection
              const existingCursor = prev.find((c) => c.user_id === payload.user_id);
              if (existingCursor) {
                return [...otherCursors, { ...existingCursor, selection: payload.selection }];
              }
            } else {
              // Remove selection from cursor
              const existingCursor = prev.find((c) => c.user_id === payload.user_id);
              if (existingCursor) {
                const { selection, ...cursorWithoutSelection } = existingCursor;
                return [...otherCursors, cursorWithoutSelection];
              }
            }
            return prev;
          });
        }
      })
      .subscribe();

    // Update cursor when path changes
    updateCursor(0, 0);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      document.removeEventListener("selectionchange", handleSelectionChange);
      clearTimeout(selectionTimeout);
      supabase.removeChannel(channel);
      supabase.removeChannel(clickChannel);
    };
  }, [userId, userName, currentPath, isEnabled]);

  return { cursors, clicks, isEnabled, setIsEnabled };
};
