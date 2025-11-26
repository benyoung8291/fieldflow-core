import { useEffect, useRef, useState } from "react";
import { useViewMode } from "@/contexts/ViewModeContext";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions) => {
  const { isMobile } = useViewMode();
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStartedPulling = useRef(false);
  const initialScrollTop = useRef(0);

  useEffect(() => {
    if (!isMobile || disabled) return;

    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      const scrollTop = container.scrollTop || window.scrollY || document.documentElement.scrollTop;
      
      // Only enable pull-to-refresh if user is at the very top
      if (scrollTop <= 3) { // Allow 3px tolerance
        startY.current = e.touches[0].clientY;
        currentY.current = e.touches[0].clientY;
        initialScrollTop.current = scrollTop;
        hasStartedPulling.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;
      
      // Check if still at top
      const scrollTop = container.scrollTop || window.scrollY || document.documentElement.scrollTop;
      
      // Only start pulling if:
      // 1. User is pulling DOWN (distance > 0)
      // 2. Still at the top of the page
      // 3. Has pulled at least 20px (intentional gesture threshold)
      if (!hasStartedPulling.current) {
        if (distance > 20 && scrollTop <= 3) {
          hasStartedPulling.current = true;
          setIsPulling(true);
        } else {
          return; // Don't do anything until threshold is met
        }
      }

      if (hasStartedPulling.current && distance > 20 && scrollTop <= 3) {
        // Apply exponential resistance to make it feel more natural
        // The further you pull, the harder it gets
        const adjustedDistance = distance - 20; // Subtract the initial threshold
        const resistanceFactor = Math.pow(adjustedDistance / threshold, 0.65);
        const finalDistance = Math.min(resistanceFactor * threshold, threshold * 1.3);
        
        setPullDistance(finalDistance);

        // Prevent default scroll behavior when actively pulling
        e.preventDefault();
      }
    };

    const handleTouchEnd = async () => {
      if (!hasStartedPulling.current) {
        setPullDistance(0);
        setIsPulling(false);
        return;
      }

      hasStartedPulling.current = false;

      if (isPulling && pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold); // Lock at threshold during refresh
        
        try {
          await onRefresh();
        } finally {
          // Smooth animation back to zero
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
            setIsPulling(false);
          }, 300);
        }
      } else {
        // Snap back animation if threshold not met
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isMobile, disabled, isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  return {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    threshold,
  };
};
