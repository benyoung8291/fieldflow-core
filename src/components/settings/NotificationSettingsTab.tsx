import { useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Volume2, VolumeX, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function NotificationSettingsTab() {
  const { 
    permission, 
    preferences, 
    requestPermission, 
    updatePreferences,
    notifyMention 
  } = useNotifications();

  useEffect(() => {
    // Auto-request permission if not already granted or denied
    if (permission === 'default') {
      requestPermission();
    }
  }, []);

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge className="bg-success"><CheckCircle className="h-3 w-3 mr-1" /> Enabled</Badge>;
      case 'denied':
        return <Badge variant="destructive"><BellOff className="h-3 w-3 mr-1" /> Blocked</Badge>;
      default:
        return <Badge variant="secondary">Not Set</Badge>;
    }
  };

  const handleTestNotification = () => {
    notifyMention(
      "Test User",
      "This is a test notification to make sure everything is working correctly!",
      () => toast.success("Notification clicked!")
    );
    toast.success("Test notification sent");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Desktop Notifications
          </CardTitle>
          <CardDescription>
            Get notified about important events even when the app is in the background
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Permission Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">Browser Permission</h4>
                {getPermissionBadge()}
              </div>
              <p className="text-sm text-muted-foreground">
                {permission === 'granted' && "Desktop notifications are enabled"}
                {permission === 'denied' && "Desktop notifications are blocked. Please enable them in your browser settings."}
                {permission === 'default' && "Click the button to enable desktop notifications"}
              </p>
            </div>
            {permission !== 'granted' && (
              <Button onClick={requestPermission}>
                Enable Notifications
              </Button>
            )}
          </div>

          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1">
              <Label htmlFor="notifications-enabled" className="text-base font-medium">
                Enable Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Master switch for all desktop notifications
              </p>
            </div>
            <Switch
              id="notifications-enabled"
              checked={preferences.enabled}
              onCheckedChange={(checked) => updatePreferences({ enabled: checked })}
              disabled={permission !== 'granted'}
            />
          </div>

          {/* Notification Types */}
          <div className="space-y-4">
            <h4 className="font-medium">Notification Types</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="notify-mentions">Mentions</Label>
                  <p className="text-sm text-muted-foreground">
                    When someone mentions you in a comment or discussion
                  </p>
                </div>
                <Switch
                  id="notify-mentions"
                  checked={preferences.mentions}
                  onCheckedChange={(checked) => updatePreferences({ mentions: checked })}
                  disabled={!preferences.enabled || permission !== 'granted'}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="notify-tasks">Task Assignments</Label>
                  <p className="text-sm text-muted-foreground">
                    When a task is assigned to you
                  </p>
                </div>
                <Switch
                  id="notify-tasks"
                  checked={preferences.taskAssignments}
                  onCheckedChange={(checked) => updatePreferences({ taskAssignments: checked })}
                  disabled={!preferences.enabled || permission !== 'granted'}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="notify-completed">Task Completions</Label>
                  <p className="text-sm text-muted-foreground">
                    When tasks you created are completed by others
                  </p>
                </div>
                <Switch
                  id="notify-completed"
                  checked={preferences.taskCompletions}
                  onCheckedChange={(checked) => updatePreferences({ taskCompletions: checked })}
                  disabled={!preferences.enabled || permission !== 'granted'}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="notify-comments">Comments</Label>
                  <p className="text-sm text-muted-foreground">
                    When someone comments on your items
                  </p>
                </div>
                <Switch
                  id="notify-comments"
                  checked={preferences.comments}
                  onCheckedChange={(checked) => updatePreferences({ comments: checked })}
                  disabled={!preferences.enabled || permission !== 'granted'}
                />
              </div>
            </div>
          </div>

          {/* Sound Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium">Sound Settings</h4>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1 flex items-center gap-2">
                {preferences.sound ? (
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="notification-sound">Notification Sound</Label>
                  <p className="text-sm text-muted-foreground">
                    Play a sound with each notification
                  </p>
                </div>
              </div>
              <Switch
                id="notification-sound"
                checked={preferences.sound}
                onCheckedChange={(checked) => updatePreferences({ sound: checked })}
                disabled={!preferences.enabled || permission !== 'granted'}
              />
            </div>
          </div>

          {/* Test Notification */}
          <div className="pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleTestNotification}
              disabled={!preferences.enabled || permission !== 'granted'}
            >
              Send Test Notification
            </Button>
          </div>

          {/* Help Text */}
          <div className="pt-4 border-t text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Note:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Notifications appear even when the app is in the background</li>
              <li>They automatically dismiss after 5 seconds</li>
              <li>Click a notification to jump to the relevant item</li>
              <li>If notifications are blocked, check your browser settings</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
