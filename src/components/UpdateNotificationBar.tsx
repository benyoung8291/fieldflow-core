import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export function UpdateNotificationBar() {
  const { needRefresh, clearCacheAndReload } = usePWAUpdate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if no update available or user dismissed
  if (!needRefresh || dismissed) return null;

  const handleUpdate = async () => {
    setIsUpdating(true);
    await clearCacheAndReload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground px-4 py-3 shadow-lg animate-in slide-in-from-top duration-300">
      <div className="flex items-center justify-center gap-3 max-w-screen-xl mx-auto">
        <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
        <span className="text-sm font-medium">
          A new version is available
        </span>
        <Button 
          size="sm" 
          variant="secondary"
          onClick={handleUpdate}
          disabled={isUpdating}
          className="h-7 px-3 text-xs font-semibold"
        >
          {isUpdating ? "Updating..." : "Update Now"}
        </Button>
        <button 
          onClick={() => setDismissed(true)}
          className="ml-2 p-1 hover:bg-primary-foreground/20 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
