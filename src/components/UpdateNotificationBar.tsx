import { useState } from 'react';
import { RefreshCw, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export function UpdateNotificationBar() {
  const { needRefresh, currentVersion, latestVersion, clearCacheAndReload, temporaryDismiss } = usePWAUpdate();
  const [isUpdating, setIsUpdating] = useState(false);

  // Don't show if no update available
  if (!needRefresh) return null;

  const handleUpdate = async () => {
    setIsUpdating(true);
    await clearCacheAndReload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground shadow-lg animate-in slide-in-from-top duration-300">
      <div className="flex items-center justify-center gap-4 px-4 py-3 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-foreground/20">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-sm font-semibold">
              New version available
            </span>
            {latestVersion && (
              <span className="text-xs opacity-90">
                v{currentVersion} → v{latestVersion}
              </span>
            )}
          </div>
        </div>
        
        <Button 
          size="sm" 
          variant="secondary"
          onClick={handleUpdate}
          disabled={isUpdating}
          className="h-8 px-4 text-xs font-semibold bg-background text-foreground hover:bg-background/90 shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isUpdating ? 'animate-spin' : ''}`} />
          {isUpdating ? "Updating..." : "Update Now"}
        </Button>
        
        <button 
          onClick={temporaryDismiss}
          className="p-1.5 hover:bg-primary-foreground/20 rounded-md transition-colors"
          aria-label="Dismiss temporarily"
          title="Dismiss (will remind you in 30 minutes)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Hook to get banner height for content offset
export function useUpdateBannerOffset() {
  const { needRefresh } = usePWAUpdate();
  return needRefresh ? 'pt-14' : '';
}
