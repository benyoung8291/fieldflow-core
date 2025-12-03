import { useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageWithProfile } from "@/types/chat";
import { cn } from "@/lib/utils";

interface MessageSearchProps {
  channelId: string;
  onSelectMessage: (messageId: string) => void;
  onClose: () => void;
}

export function MessageSearch({ channelId, onSelectMessage, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessageWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Import supabase inline to avoid hook issues
  const handleSearch = async () => {
    if (query.length < 2) return;
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      
      const { data, error } = await supabase
        .from("chat_messages")
        .select(`
          *,
          profile:profiles!chat_messages_user_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          ),
          attachments:chat_attachments(*),
          reactions:chat_reactions(*)
        `)
        .eq("channel_id", channelId)
        .is("deleted_at", null)
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      setResults((data || []).map((msg) => ({
        ...msg,
        profile: msg.profile || null,
        attachments: msg.attachments || [],
        reactions: msg.reactions || [],
      })) as MessageWithProfile[]);
    } catch (error) {
      console.error("[Chat] Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search messages..."
          className="border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
          autoFocus
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => {
              setQuery("");
              setResults([]);
              setHasSearched(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSearch}
          disabled={query.length < 2 || isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : results.length > 0 ? (
          <div className="divide-y">
            {results.map((message) => {
              const initials = message.profile
                ? `${message.profile.first_name?.[0] || ""}${message.profile.last_name?.[0] || ""}`.toUpperCase()
                : "?";
              const name = message.profile
                ? `${message.profile.first_name || ""} ${message.profile.last_name || ""}`.trim()
                : "Unknown";

              return (
                <button
                  key={message.id}
                  className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    onSelectMessage(message.id);
                    onClose();
                  }}
                >
                  <div className="flex items-start gap-2">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={message.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {highlightText(message.content, query)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : hasSearched ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Search className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No messages found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Try different keywords
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Search className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Search messages in this channel</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Enter at least 2 characters
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
