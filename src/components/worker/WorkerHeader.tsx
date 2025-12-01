import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ViewToggleButton } from "@/components/layout/ViewToggleButton";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";

interface WorkerHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backPath?: string;
  showRefresh?: boolean;
  showOnlineStatus?: boolean;
  children?: React.ReactNode;
}

export function WorkerHeader({ 
  title, 
  subtitle,
  showBack = false, 
  backPath = "/worker/dashboard",
  showRefresh = false,
  showOnlineStatus = true,
  children 
}: WorkerHeaderProps) {
  const navigate = useNavigate();
  const { isOnline } = useOfflineSync();
  const { clearCacheAndReload } = usePWAUpdate();

  return (
    <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(backPath)}
                className="h-9 w-9 rounded-full text-primary-foreground hover:bg-primary-foreground/20 -ml-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              {subtitle && <p className="text-xs font-medium opacity-90">{subtitle}</p>}
              <h1 className="text-lg font-bold">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showOnlineStatus && (
              isOnline ? (
                <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" title="Online" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]" title="Offline" />
              )
            )}
            <ViewToggleButton />
            {showRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearCacheAndReload}
                className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/20"
                title="Update app"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {children}
          </div>
        </div>
      </div>
    </header>
  );
}
