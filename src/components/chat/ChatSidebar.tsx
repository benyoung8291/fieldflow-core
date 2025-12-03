import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Hash, Lock, ChevronDown, ChevronRight, Bell, X, Settings, Plus, Search } from "lucide-react";
import { useChatChannels } from "@/hooks/chat/useChatChannels";
import { useUnreadMessages } from "@/hooks/chat/useUnreadMessages";
import { useDMChannelNames } from "@/hooks/chat/useDMChannelName";
import { useChatPresence } from "@/hooks/chat/useChatPresence";
import { requestNotificationPermission, useNotificationPermission } from "@/hooks/chat/useChatNotifications";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
    const isWorkerApp = location.pathname.startsWith("/worker");
    const basePath = isWorkerApp ? "/worker/chat" : "/chat";
    navigate(`${basePath}/${id}`);
  };

  const showNotificationBanner =
    !notificationBannerDismissed &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    notificationPermission === "default";

  const totalUnread = unreadData?.totalUnread || 0;

  return (
    <div className="flex h-full flex-col bg-slack-aubergine text-slack-text pb-safe">
      {/* Workspace Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-slack-border">
        <span className="font-bold text-lg text-white">Workspace</span>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slack-text-muted hover:text-white hover:bg-slack-hover"
                  onClick={() => setSwitcherOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Search (⌘K)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Notification Banner */}
      {showNotificationBanner && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-md bg-slack-active/20 px-3 py-2">
          <Bell className="h-4 w-4 text-slack-text-muted" />
          <button
            onClick={handleEnableNotifications}
            className="text-sm font-medium text-white hover:underline flex-1 text-left"
          >
            Enable notifications
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-slack-text-muted hover:text-white"
            onClick={handleDismissBanner}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Removed placeholder quick actions - Threads, Drafts, Saved items not implemented */}

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slack-text-muted" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 bg-slack-hover border-none text-white placeholder:text-slack-text-muted text-sm focus-visible:ring-1 focus-visible:ring-slack-active"
          />
        </div>
      </div>

      {/* Channel Lists */}
      <ScrollArea className="flex-1 px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-sm text-slack-text-muted">Loading...</span>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {/* Channels Section */}
            <Collapsible open={channelsOpen} onOpenChange={setChannelsOpen}>
              <div className="flex items-center justify-between px-1 group">
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-slack-text-muted hover:text-white transition-colors">
                  {channelsOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span className="font-medium">Channels</span>
                </CollapsibleTrigger>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 text-slack-text-muted hover:text-white hover:bg-slack-hover transition-all"
                        onClick={() => setCreateChannelOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Add channel</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CollapsibleContent className="mt-1 space-y-0.5">
                {publicPrivateChannels.length === 0 ? (
                  <button
                    onClick={() => setCreateChannelOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-sm text-slack-text-muted hover:bg-slack-hover hover:text-white transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add a channel</span>
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
                          "flex w-full items-center gap-2 rounded-md px-3 py-1 text-sm transition-colors",
                          isActive
                            ? "bg-slack-active text-white"
                            : "text-slack-text-muted hover:bg-slack-hover hover:text-white",
                          unreadCount > 0 && "text-white font-medium"
                        )}
                      >
                        {channel.type === "private" ? (
                          <Lock className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <Hash className="h-4 w-4 flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate text-left">
                          {channel.name || "Unnamed"}
                        </span>
                        {unreadCount > 0 && (
                          <span className="flex-shrink-0 text-xs bg-destructive text-destructive-foreground rounded-full px-1.5 min-w-[18px] text-center">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Direct Messages Section */}
            <Collapsible open={dmsOpen} onOpenChange={setDmsOpen}>
              <div className="flex items-center justify-between px-1 group relative">
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-slack-text-muted hover:text-white transition-colors">
                  {dmsOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span className="font-medium">Direct messages</span>
                </CollapsibleTrigger>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 text-slack-text-muted hover:text-white hover:bg-slack-hover transition-all"
                        onClick={() => setNewDMOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>New message</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CollapsibleContent className="mt-1 space-y-0.5">
                {dmChannels.length === 0 ? (
                  <button
                    onClick={() => setNewDMOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-sm text-slack-text-muted hover:bg-slack-hover hover:text-white transition-colors"
                  >
                    <Plus className="h-4 w-4" />
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
                          "flex w-full items-center gap-2 rounded-md px-3 py-1 text-sm transition-colors",
                          isActive
                            ? "bg-slack-active text-white"
                            : "text-slack-text-muted hover:bg-slack-hover hover:text-white",
                          unreadCount > 0 && "text-white font-medium"
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={dmInfo?.otherUserAvatar || undefined} />
                            <AvatarFallback className="text-[9px] bg-slack-avatar text-slack-avatar-foreground">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <OnlineIndicator
                            isOnline={isOnline}
                            size="xs"
                            className="absolute -bottom-0.5 -right-0.5 border border-slack-aubergine"
                          />
                        </div>
                        <span className="flex-1 truncate text-left">
                          {displayName}
                        </span>
                        {unreadCount > 0 && (
                          <span className="flex-shrink-0 text-xs bg-destructive text-destructive-foreground rounded-full px-1.5 min-w-[18px] text-center">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
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
      <div className="border-t border-slack-border p-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-slack-text-muted hover:text-white hover:bg-slack-hover"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
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
