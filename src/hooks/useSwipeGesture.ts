import { useEffect, useRef, useState } from "react";

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minSwipeDistance?: number;
  preventScroll?: boolean;
}

export const useSwipeGesture = (options: SwipeGestureOptions) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    minSwipeDistance = 50,
    preventScroll = false,
  } = options;

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping) return;
    
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;

    if (preventScroll) {
      const deltaX = Math.abs(touchEndX.current - touchStartX.current);
      const deltaY = Math.abs(touchEndY.current - touchStartY.current);
      
      // If horizontal swipe is more significant, prevent vertical scroll
      if (deltaX > deltaY) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;
    
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = touchEndY.current - touchStartY.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine if swipe is more horizontal or vertical
    if (absDeltaX > absDeltaY && absDeltaX > minSwipeDistance) {
      // Horizontal swipe
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    } else if (absDeltaY > absDeltaX && absDeltaY > minSwipeDistance) {
      // Vertical swipe
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }

    setIsSwiping(false);
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isSwiping,
  };
};

export const useSwipeToClose = (onClose: () => void, enabled: boolean = true) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  
  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger on edge swipe (within 20px from left edge)
      if (e.touches[0].clientX > 20) return;
      
      startX = e.touches[0].clientX;
      isDragging = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      
      currentX = e.touches[0].clientX;
      const diff = currentX - startX;
      
      if (diff > 0) {
        // Calculate progress (0 to 1)
        const progress = Math.min(diff / 300, 1);
        setSwipeProgress(progress);
        
        // Apply transform
        element.style.transform = `translateX(${diff}px)`;
        element.style.opacity = String(1 - progress * 0.3);
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;
      
      const diff = currentX - startX;
      
      if (diff > 150) {
        // Complete the swipe
        element.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
        element.style.transform = 'translateX(100%)';
        element.style.opacity = '0';
        setTimeout(() => {
          onClose();
        }, 200);
      } else {
        // Reset
        element.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
        element.style.transform = 'translateX(0)';
        element.style.opacity = '1';
        setTimeout(() => {
          element.style.transition = '';
        }, 200);
      }
      
      isDragging = false;
      setSwipeProgress(0);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onClose]);

  return { elementRef, swipeProgress };
};
