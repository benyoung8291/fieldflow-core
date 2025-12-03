import { Home, MessageCircle, Bell, MoreHorizontal } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/chat/useUnreadMessages";

interface TabItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

export function BottomTabNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: unreadData } = useUnreadMessages();

  const tabs: TabItem[] = [
    { icon: Home, label: "Home", path: "/worker/chat" },
    { icon: MessageCircle, label: "DMs", path: "/worker/chat", badge: unreadData?.totalUnread },
    { icon: Bell, label: "Activity", path: "/worker/chat" },
    { icon: MoreHorizontal, label: "More", path: "/worker/chat" },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-safe">
      <nav className="flex h-14 items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          
          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-4 py-2 transition-colors relative",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
