import { useTeamPresence } from "@/hooks/useTeamPresence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";

export const PresenceDebug = () => {
  const { activeUsers } = useTeamPresence();
  const { permission, requestPermission, notifyMention } = useNotifications();

  const handleTestNotification = async () => {
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        toast.error("Please grant notification permission");
        return;
      }
    }
    
    await notifyMention("Test User", "This is a test notification");
    toast.success("Test notification sent!");
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm space-y-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Presence Debug</CardTitle>
          <CardDescription className="text-xs">
            Active Users: {activeUsers.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No other users online</p>
          ) : (
            <div className="space-y-1">
              {activeUsers.map((user) => (
                <div key={user.user_id} className="text-xs">
                  <span className="font-medium">{user.user_name}</span>
                  <div className="text-muted-foreground">
                    {user.locations.map((loc, idx) => (
                      <div key={idx}>• {loc.page}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Notifications Debug</CardTitle>
          <CardDescription className="text-xs">
            Permission: <Badge variant="outline" className="ml-1">{permission}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            size="sm" 
            className="w-full" 
            onClick={handleTestNotification}
          >
            Test Notification
          </Button>
          {permission === 'denied' && (
            <p className="text-xs text-destructive">
              Notifications blocked. Please enable in browser settings.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
