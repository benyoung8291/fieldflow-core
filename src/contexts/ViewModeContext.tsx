import React, { createContext, useContext, useState, useEffect } from 'react';

export type ViewMode = 'auto' | 'desktop' | 'mobile';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isMobile: boolean;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

const MOBILE_BREAKPOINT = 768;

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved as ViewMode) || 'auto';
  });

  const [screenIsMobile, setScreenIsMobile] = useState<boolean>(
    window.innerWidth < MOBILE_BREAKPOINT
  );

  // Listen to screen size changes
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setScreenIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    mql.addEventListener("change", onChange);
    onChange();
    
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem('viewMode', mode);
  };

  // Determine if we should show mobile UI
  const isMobile = viewMode === 'mobile' 
    ? true 
    : viewMode === 'desktop' 
      ? false 
      : screenIsMobile; // auto mode uses screen size

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, isMobile }}>
      {children}
    </ViewModeContext.Provider>
  );
};

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
};
