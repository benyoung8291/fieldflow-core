import * as React from "react";
import { ViewMode } from "./useViewMode";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const viewMode = localStorage.getItem('viewMode') as ViewMode || 'auto';
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      const screenIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
      
      // Respect manual view mode override
      if (viewMode === 'mobile') {
        setIsMobile(true);
      } else if (viewMode === 'desktop') {
        setIsMobile(false);
      } else {
        // Auto mode - use screen size
        setIsMobile(screenIsMobile);
      }
    };
    
    mql.addEventListener("change", onChange);
    onChange(); // Initial check
    
    // Listen for view mode changes
    window.addEventListener('resize', onChange);
    
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);

  return !!isMobile;
}
