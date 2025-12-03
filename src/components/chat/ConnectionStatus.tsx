import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  isConnected: boolean;
  isReconnecting: boolean;
  onReconnect?: () => void;
}

export function ConnectionStatus({ isConnected, isReconnecting, onReconnect }: ConnectionStatusProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setVisible(true);
    } else {
      // Hide after a short delay when reconnected
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  if (!visible && isConnected) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium transition-all",
        isConnected
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : "bg-destructive/10 text-destructive"
      )}
    >
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Connected</span>
        </>
      ) : isReconnecting ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Reconnecting...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Disconnected</span>
          {onReconnect && (
            <button
              onClick={onReconnect}
              className="ml-1 underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </>
      )}
    </div>
  );
}
