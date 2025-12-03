import { useEffect, useState, useRef } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  isConnected: boolean;
  isReconnecting: boolean;
  onReconnect?: () => void;
}

export function ConnectionStatus({ isConnected, isReconnecting, onReconnect }: ConnectionStatusProps) {
  const [visible, setVisible] = useState(false);
  const hasEverConnected = useRef(false);

  useEffect(() => {
    if (isConnected) {
      hasEverConnected.current = true;
      // Hide after a short delay when reconnected
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    } else if (hasEverConnected.current) {
      // Only show disconnected banner if we've connected at least once
      setVisible(true);
    }
    // If never connected, don't show anything (initial connecting state)
  }, [isConnected]);

  // Don't show during initial connection attempts
  if (!hasEverConnected.current) return null;
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
