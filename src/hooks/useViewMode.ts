import { useState, useEffect } from 'react';

export type ViewMode = 'auto' | 'desktop' | 'mobile';

export const useViewMode = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved as ViewMode) || 'auto';
  });

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  return {
    viewMode,
    setViewMode,
  };
};
