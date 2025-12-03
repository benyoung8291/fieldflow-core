import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { useChatSettings } from "@/hooks/chat/useChatSettings";
import { requestNotificationPermission, useNotificationPermission } from "@/hooks/chat/useChatNotifications";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface ChatSettingsPanelProps {
  onClose?: () => void;
}

export function ChatSettingsPanel({ onClose }: ChatSettingsPanelProps) {
  const { soundEnabled, desktopNotifications, toggleSound, toggleDesktopNotifications } = useChatSettings();
  const notificationPermission = useNotificationPermission();

  const handleEnableNotifications = async () => {
    const permission = await requestNotificationPermission();
    if (permission === "granted") {
      toggleDesktopNotifications();
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Chat Settings</h3>
        
        {/* Sound Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2 className="h-5 w-5 text-muted-foreground" />
              ) : (
                <VolumeX className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="sound-toggle" className="text-sm font-medium">
                  Notification Sounds
                </Label>
                <p className="text-xs text-muted-foreground">
                  Play a sound when you receive new messages
                </p>
              </div>
            </div>
            <Switch
              id="sound-toggle"
              checked={soundEnabled}
              onCheckedChange={toggleSound}
            />
          </div>

          <Separator />

          {/* Desktop Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {desktopNotifications ? (
                <Bell className="h-5 w-5 text-muted-foreground" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="notification-toggle" className="text-sm font-medium">
                  Desktop Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show system notifications for new messages
                </p>
              </div>
            </div>
            {notificationPermission === "granted" ? (
              <Switch
                id="notification-toggle"
                checked={desktopNotifications}
                onCheckedChange={toggleDesktopNotifications}
              />
            ) : notificationPermission === "denied" ? (
              <span className="text-xs text-muted-foreground">
                Blocked by browser
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={handleEnableNotifications}>
                Enable
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Keyboard Shortcuts Info */}
      <div>
        <h4 className="text-sm font-medium mb-3">Keyboard Shortcuts</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Quick channel switch</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⌘K</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Send message</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Enter</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">New line</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Shift+Enter</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Cancel edit/reply</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Esc</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
