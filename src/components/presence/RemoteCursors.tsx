import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeCursor } from "@/hooks/useRealtimeCursor";
import { MousePointer2 } from "lucide-react";

export default function RemoteCursors() {
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-cursor"],
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
          ? `${profile.first_name} ${profile.last_name}`
          : user.email || "Unknown User",
      };
    },
  });

  const { cursors, clicks } = useRealtimeCursor(
    currentUser?.name || "",
    currentUser?.id || ""
  );

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

  // Calculate cursor position with element anchoring
  const calculateCursorPosition = (cursor: any): { x: number; y: number; isAnchored: boolean } | null => {
    // Try element anchoring first
    if (cursor.elementId && cursor.elementX !== undefined && cursor.elementY !== undefined) {
      const element = findElementById(cursor.elementId);
      
      if (element) {
        const rect = element.getBoundingClientRect();
        
        // Convert element-relative percentage to viewport pixels
        const x = rect.left + (cursor.elementX / 100) * rect.width;
        const y = rect.top + (cursor.elementY / 100) * rect.height;
        
        // Check if position is in viewport
        if (x >= -50 && x <= window.innerWidth + 50 &&
            y >= -50 && y <= window.innerHeight + 50) {
          return { x, y, isAnchored: true };
        }
      }
    }
    
    // Fall back to document coordinates
    const currentScrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    const body = document.body;
    const html = document.documentElement;
    const docWidth = Math.max(
      body.scrollWidth, body.offsetWidth,
      html.clientWidth, html.scrollWidth, html.offsetWidth
    );
    const docHeight = Math.max(
      body.scrollHeight, body.offsetHeight,
      html.clientHeight, html.scrollHeight, html.offsetHeight
    );
    
    const docX = (cursor.x / 100) * docWidth;
    const docY = (cursor.y / 100) * docHeight;
    
    const viewportX = docX - currentScrollX;
    const viewportY = docY - currentScrollY;
    
    const currentZoom = window.devicePixelRatio || 1;
    const zoomRatio = cursor.zoom ? currentZoom / cursor.zoom : 1;
    
    const finalX = viewportX * zoomRatio;
    const finalY = viewportY * zoomRatio;
    
    if (finalX >= -50 && finalX <= window.innerWidth + 50 &&
        finalY >= -50 && finalY <= window.innerHeight + 50) {
      return { x: finalX, y: finalY, isAnchored: false };
    }
    
    return null;
  };

  return (
    <>
      {/* Render cursors */}
      {cursors.map((cursor) => {
        const position = calculateCursorPosition(cursor);
        
        if (!position) return null;
        
        return (
          <div
            key={cursor.user_id}
            className="fixed pointer-events-none z-[9999] transition-all duration-100 ease-out"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: "translate(-2px, -2px)",
            }}
          >
            <MousePointer2
              className="h-5 w-5 drop-shadow-lg"
              style={{ 
                color: cursor.color,
                fill: cursor.color,
              }}
            />
            <div
              className="absolute left-4 top-1 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.user_name}
              {position.isAnchored && cursor.elementType && (
                <span className="ml-1 opacity-75">
                  on {cursor.elementType}
                </span>
              )}
            </div>
          </div>
        );
      })}
      
      {/* Render click animations */}
      {clicks.map((click) => {
        // Convert percentage to pixels based on current viewport
        const xPixels = (click.x / 100) * window.innerWidth;
        const yPixels = (click.y / 100) * window.innerHeight;
        
        return (
          <div
            key={click.id}
            className="fixed pointer-events-none z-[9999]"
            style={{
              left: `${xPixels}px`,
              top: `${yPixels}px`,
            }}
          >
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping"
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: click.color,
                opacity: 0.6,
              }}
            />
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse"
              style={{
                width: "20px",
                height: "20px",
                backgroundColor: click.color,
                opacity: 0.8,
              }}
            />
          </div>
        );
      })}
    </>
  );
}
