import { Monitor, Smartphone, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewMode } from "@/contexts/ViewModeContext";

export const ViewModeToggle = () => {
  const { viewMode, setViewMode } = useViewMode();

  const cycleViewMode = () => {
    if (viewMode === 'auto') {
      setViewMode('desktop');
    } else if (viewMode === 'desktop') {
      setViewMode('mobile');
    } else {
      setViewMode('auto');
    }
  };

  const getIcon = () => {
    switch (viewMode) {
      case 'desktop':
        return <Monitor className="h-4 w-4" />;
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Laptop className="h-4 w-4" />;
    }
  };

  const getLabel = () => {
    switch (viewMode) {
      case 'desktop':
        return 'Desktop View';
      case 'mobile':
        return 'Mobile View';
      default:
        return 'Auto (Responsive)';
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-9 w-9" 
      onClick={cycleViewMode}
      title={getLabel()}
    >
      {getIcon()}
      <span className="sr-only">{getLabel()}</span>
    </Button>
  );
};
