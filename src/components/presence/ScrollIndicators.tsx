import { useEffect, useState } from "react";
import { CursorPosition } from "@/hooks/useRealtimeCursor";

interface ScrollIndicatorsProps {
  cursors: CursorPosition[];
}

export default function ScrollIndicators({ cursors }: ScrollIndicatorsProps) {
  const [documentHeight, setDocumentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const updateDimensions = () => {
      const body = document.body;
      const html = document.documentElement;
      
      const height = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );
      
      setDocumentHeight(height);
      setViewportHeight(window.innerHeight);
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    
    // Update on content changes
    const observer = new MutationObserver(updateDimensions);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.removeEventListener("resize", updateDimensions);
      observer.disconnect();
    };
  }, []);

  if (documentHeight <= viewportHeight) {
    // No scrolling needed, don't show indicators
    return null;
  }

  return (
    <div className="fixed right-0 top-0 h-full w-3 pointer-events-none z-[9997] flex flex-col">
      {/* Scrollbar track background */}
      <div className="absolute inset-0 bg-border/20" />
      
      {/* User viewport indicators */}
      {cursors.map((cursor) => {
        // Calculate viewport position as percentage of document
        const topPercent = (cursor.scrollY / documentHeight) * 100;
        const heightPercent = (cursor.viewportHeight / documentHeight) * 100;
        
        return (
          <div
            key={`scroll-${cursor.user_id}`}
            className="absolute w-full transition-all duration-200 ease-out"
            style={{
              top: `${topPercent}%`,
              height: `${heightPercent}%`,
              backgroundColor: cursor.color,
              opacity: 0.6,
              boxShadow: `0 0 8px ${cursor.color}40`,
            }}
            title={`${cursor.user_name} is viewing here`}
          >
            {/* User name label - only show if there's enough space */}
            {heightPercent > 3 && (
              <div
                className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg"
                style={{
                  backgroundColor: cursor.color,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                {cursor.user_name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
