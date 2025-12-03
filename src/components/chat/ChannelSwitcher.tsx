import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Hash, Lock, MessageCircle, Search } from "lucide-react";
import { useChatChannels } from "@/hooks/chat/useChatChannels";
import { useDMChannelNames } from "@/hooks/chat/useDMChannelName";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface ChannelSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChannelSwitcher({ open, onOpenChange }: ChannelSwitcherProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: channels = [] } = useChatChannels();

  // Get DM channel IDs for name lookup
  const dmChannelIds = useMemo(
    () => channels.filter((c) => c.type === "dm").map((c) => c.id),
    [channels]
  );
  const { data: dmNames = {} } = useDMChannelNames(dmChannelIds);

  const publicPrivateChannels = useMemo(
    () => channels.filter((c) => c.type === "public" || c.type === "private" || c.type === "context"),
    [channels]
  );

  const dmChannels = useMemo(
    () => channels.filter((c) => c.type === "dm"),
    [channels]
  );

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

  const handleSelect = (channelId: string) => {
    // Determine if we're in worker app or office app
    const isWorkerApp = location.pathname.startsWith("/worker");
    const basePath = isWorkerApp ? "/worker/chat" : "/chat";
    navigate(`${basePath}/${channelId}`);
    onOpenChange(false);
  };

  const getChannelName = (channel: typeof channels[0]) => {
    if (channel.type === "dm") {
      return dmNames[channel.id]?.otherUserName || "Direct Message";
    }
    return channel.name || "Unnamed Channel";
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search channels..." />
      <CommandList>
        <CommandEmpty>No channels found.</CommandEmpty>
        
        {publicPrivateChannels.length > 0 && (
          <CommandGroup heading="Channels">
            {publicPrivateChannels.map((channel) => (
              <CommandItem
                key={channel.id}
                value={channel.name || channel.id}
                onSelect={() => handleSelect(channel.id)}
                className="flex items-center gap-2"
              >
                {getChannelIcon(channel.type)}
                <span>{channel.name || "Unnamed Channel"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {dmChannels.length > 0 && (
          <CommandGroup heading="Direct Messages">
            {dmChannels.map((channel) => (
              <CommandItem
                key={channel.id}
                value={getChannelName(channel)}
                onSelect={() => handleSelect(channel.id)}
                className="flex items-center gap-2"
              >
                {getChannelIcon(channel.type)}
                <span>{getChannelName(channel)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Hook to manage Cmd+K shortcut
export function useChannelSwitcher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}
