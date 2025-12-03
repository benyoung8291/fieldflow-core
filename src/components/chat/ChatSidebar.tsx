import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Hash, Lock, MessageCircle, Plus, Search, ChevronDown, ChevronRight } from "lucide-react";
import { useChatChannels } from "@/hooks/chat/useChatChannels";
import { useUnreadMessages } from "@/hooks/chat/useUnreadMessages";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function ChatSidebar() {
  const navigate = useNavigate();
  const { channelId } = useParams();
  const { data: channels = [], isLoading } = useChatChannels();
  const { data: unreadData } = useUnreadMessages();
  const [searchQuery, setSearchQuery] = useState("");
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const query = searchQuery.toLowerCase();
    return channels.filter((channel) =>
      channel.name?.toLowerCase().includes(query)
    );
  }, [channels, searchQuery]);

  const publicPrivateChannels = useMemo(
    () => filteredChannels.filter((c) => c.type === "public" || c.type === "private" || c.type === "context"),
    [filteredChannels]
  );

  const dmChannels = useMemo(
    () => filteredChannels.filter((c) => c.type === "dm"),
    [filteredChannels]
  );

  const handleChannelClick = (id: string) => {
    navigate(`/chat/${id}`);
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

  return (
    <div className="flex h-full flex-col border-r bg-sidebar">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <h2 className="text-lg font-semibold">Messages</h2>
      </div>

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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    // TODO: Open create channel dialog
                    console.log("Create channel clicked");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <CollapsibleContent className="mt-1 space-y-0.5">
                {publicPrivateChannels.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">No channels found</p>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    // TODO: Open new DM dialog
                    console.log("New DM clicked");
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <CollapsibleContent className="mt-1 space-y-0.5">
                {dmChannels.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">No direct messages</p>
                ) : (
                  dmChannels.map((channel) => {
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
                          {channel.name || "Direct Message"}
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
    </div>
  );
}
