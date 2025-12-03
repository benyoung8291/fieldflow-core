import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Hash, Lock, MessageCircle, Plus, Search, ChevronDown, ChevronRight, Bell, X, Command, Settings, Users } from "lucide-react";
import { useChatChannels } from "@/hooks/chat/useChatChannels";
import { useUnreadMessages } from "@/hooks/chat/useUnreadMessages";
import { useDMChannelNames } from "@/hooks/chat/useDMChannelName";
import { useChatPresence } from "@/hooks/chat/useChatPresence";
import { requestNotificationPermission, useNotificationPermission } from "@/hooks/chat/useChatNotifications";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CreateChannelDialog } from "./dialogs/CreateChannelDialog";
import { NewDMDialog } from "./dialogs/NewDMDialog";
import { OnlineIndicator } from "./OnlineIndicator";
import { ChannelSwitcher, useChannelSwitcher } from "./ChannelSwitcher";
import { ChatSettingsPanel } from "./ChatSettingsPanel";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ChatSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { channelId } = useParams();
  const { data: channels = [], isLoading } = useChatChannels();
  const { data: unreadData } = useUnreadMessages();
  const { isUserOnline } = useChatPresence();
  const [searchQuery, setSearchQuery] = useState("");
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [notificationBannerDismissed, setNotificationBannerDismissed] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newDMOpen, setNewDMOpen] = useState(false);
  const notificationPermission = useNotificationPermission();
  const { open: switcherOpen, setOpen: setSwitcherOpen } = useChannelSwitcher();

  // Get DM channel IDs for name lookup
  const dmChannelIds = useMemo(
    () => channels.filter((c) => c.type === "dm").map((c) => c.id),
    [channels]
  );
  const { data: dmNames = {} } = useDMChannelNames(dmChannelIds);

  // Check if notification banner was previously dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem("chat-notification-banner-dismissed");
    if (dismissed === "true") {
      setNotificationBannerDismissed(true);
    }
  }, []);

  const handleEnableNotifications = async () => {
    const permission = await requestNotificationPermission();
    if (permission === "granted") {
      toast.success("Notifications enabled!");
      setNotificationBannerDismissed(true);
    } else if (permission === "denied") {
      toast.error("Notifications blocked. Please enable them in your browser settings.");
    }
  };

  const handleDismissBanner = () => {
    setNotificationBannerDismissed(true);
    localStorage.setItem("chat-notification-banner-dismissed", "true");
  };

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const query = searchQuery.toLowerCase();
    return channels.filter((channel) => {
      if (channel.type === "dm") {
        const dmInfo = dmNames[channel.id];
        return dmInfo?.otherUserName.toLowerCase().includes(query);
      }
      return channel.name?.toLowerCase().includes(query);
    });
  }, [channels, searchQuery, dmNames]);

  const publicPrivateChannels = useMemo(
    () => filteredChannels.filter((c) => c.type === "public" || c.type === "private" || c.type === "context"),
    [filteredChannels]
  );

  const dmChannels = useMemo(
    () => filteredChannels.filter((c) => c.type === "dm"),
    [filteredChannels]
  );

  const handleChannelClick = (id: string) => {
    // Determine if we're in worker app or office app
    const isWorkerApp = location.pathname.startsWith("/worker");
    const basePath = isWorkerApp ? "/worker/chat" : "/chat";
    navigate(`${basePath}/${id}`);
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "private":
        return <Lock className="h-4 w-4 text-muted-foreground" />;
      case "dm":
        return <MessageCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Hash className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const showNotificationBanner =
    !notificationBannerDismissed &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    notificationPermission === "default";

  return (
    <div className="flex h-full flex-col border-r bg-sidebar">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h2 className="text-lg font-semibold">Messages</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => setSwitcherOpen(true)}
        >
          <Command className="h-3 w-3" />
          <span>K</span>
        </Button>
      </div>

      {/* Notification Banner */}
      {showNotificationBanner && (
        <Alert className="mx-3 mt-3 border-primary/50 bg-primary/10">
          <Bell className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <button
              onClick={handleEnableNotifications}
              className="text-sm font-medium text-primary hover:underline"
            >
              Enable notifications
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDismissBanner}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Channel Lists */}
      <ScrollArea className="flex-1 px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {/* Channels Section */}
            <Collapsible open={channelsOpen} onOpenChange={setChannelsOpen}>
              <div className="flex items-center justify-between px-2">
                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  {channelsOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Channels
                </CollapsibleTrigger>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 border-border/50 bg-background/50 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setCreateChannelOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Create Channel</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CollapsibleContent className="mt-1 space-y-0.5">
                {publicPrivateChannels.length === 0 ? (
                  <button
                    onClick={() => setCreateChannelOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create your first channel</span>
                  </button>
                ) : (
                  publicPrivateChannels.map((channel) => {
                    const unreadCount = unreadData?.channelUnreadCounts[channel.id] || 0;
                    const isActive = channelId === channel.id;

                    return (
                      <button
                        key={channel.id}
                        onClick={() => handleChannelClick(channel.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          unreadCount > 0 && "font-semibold text-foreground"
                        )}
                      >
                        {getChannelIcon(channel.type)}
                        <span className="flex-1 truncate text-left">
                          {channel.name || "Unnamed Channel"}
                        </span>
                        {unreadCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Direct Messages Section */}
            <Collapsible open={dmsOpen} onOpenChange={setDmsOpen}>
              <div className="flex items-center justify-between px-2">
                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  {dmsOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Direct Messages
                </CollapsibleTrigger>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 border-border/50 bg-background/50 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setNewDMOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>New Message</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CollapsibleContent className="mt-1 space-y-0.5">
                {dmChannels.length === 0 ? (
                  <button
                    onClick={() => setNewDMOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                  >
                    <Users className="h-4 w-4" />
                    <span>Start a conversation</span>
                  </button>
                ) : (
                  dmChannels.map((channel) => {
                    const unreadCount = unreadData?.channelUnreadCounts[channel.id] || 0;
                    const isActive = channelId === channel.id;
                    const dmInfo = dmNames[channel.id];
                    const displayName = dmInfo?.otherUserName || "Direct Message";
                    const isOnline = dmInfo?.otherUserId ? isUserOnline(dmInfo.otherUserId) : false;
                    const initials = displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <button
                        key={channel.id}
                        onClick={() => handleChannelClick(channel.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          unreadCount > 0 && "font-semibold text-foreground"
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={dmInfo?.otherUserAvatar || undefined} />
                            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                          </Avatar>
                          <OnlineIndicator
                            isOnline={isOnline}
                            size="sm"
                            className="absolute -bottom-0.5 -right-0.5"
                          />
                        </div>
                        <span className="flex-1 truncate text-left">
                          {displayName}
                        </span>
                        {unreadCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </ScrollArea>

      {/* Footer with Settings */}
      <div className="border-t p-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
              <Settings className="h-4 w-4" />
              <span>Chat Settings</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <ChatSettingsPanel />
          </SheetContent>
        </Sheet>
      </div>

      {/* Dialogs */}
      <CreateChannelDialog open={createChannelOpen} onOpenChange={setCreateChannelOpen} />
      <NewDMDialog open={newDMOpen} onOpenChange={setNewDMOpen} />
      <ChannelSwitcher open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </div>
  );
}
