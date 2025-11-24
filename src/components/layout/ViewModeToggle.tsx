import { Monitor, Smartphone, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewMode } from "@/contexts/ViewModeContext";

export const ViewModeToggle = () => {
  try {
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
          return 'Desktop';
        case 'mobile':
          return 'Mobile';
        default:
          return 'Auto';
      }
    };

    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="gap-2 border border-border shrink-0" 
        onClick={cycleViewMode}
        title={`View Mode: ${getLabel()}`}
      >
        {getIcon()}
        <span className="text-xs font-medium">{getLabel()}</span>
      </Button>
    );
  } catch (error) {
    console.error("ViewModeToggle error:", error);
    return (
      <Button variant="outline" size="sm" className="gap-2" disabled>
        <Monitor className="h-4 w-4" />
        <span className="text-xs">View</span>
      </Button>
    );
  }
};
