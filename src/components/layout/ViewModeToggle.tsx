import { Monitor, Smartphone, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useViewMode, ViewMode } from "@/hooks/useViewMode";

export const ViewModeToggle = () => {
  const { viewMode, setViewMode } = useViewMode();

  const getIcon = () => {
    switch (viewMode) {
      case 'desktop':
        return <Monitor className="h-5 w-5" />;
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      default:
        return <Laptop className="h-5 w-5" />;
    }
  };

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    // Force a re-render by triggering a resize event
    window.dispatchEvent(new Event('resize'));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          {getIcon()}
          <span className="sr-only">Toggle view mode</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 bg-popover backdrop-blur-sm">
        <DropdownMenuItem onClick={() => handleModeChange('auto')}>
          <Laptop className="mr-2 h-4 w-4" />
          <span>Auto (Responsive)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleModeChange('desktop')}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>Desktop View</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleModeChange('mobile')}>
          <Smartphone className="mr-2 h-4 w-4" />
          <span>Mobile View</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
