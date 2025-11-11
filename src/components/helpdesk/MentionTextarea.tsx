import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string, mentions: string[]) => void;
  placeholder?: string;
  rows?: number;
}

export function MentionTextarea({ value, onChange, placeholder, rows }: MentionTextareaProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: users } = useQuery({
    queryKey: ["users-for-mentions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user?.id || "")
        .single();

      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("tenant_id", profile?.tenant_id || "")
        .order("first_name");

      return data || [];
    },
  });

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);

    // Check if @ was just typed
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1 && lastAtIndex === cursorPos - 1) {
      setShowMentions(true);
      setMentionSearch("");
    } else if (lastAtIndex !== -1) {
      const searchTerm = textBeforeCursor.slice(lastAtIndex + 1);
      if (!searchTerm.includes(" ") && !searchTerm.includes("\n")) {
        setShowMentions(true);
        setMentionSearch(searchTerm);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }

    // Extract mentions from text
    const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionPattern.exec(newValue)) !== null) {
      mentions.push(match[2]); // Extract user ID
    }

    onChange(newValue, mentions);
  };

  const handleSelectUser = (user: any) => {
    if (!textareaRef.current) return;

    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = value.slice(cursorPosition);

    // Replace @search with @[Name](userId)
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    const newValue =
      value.slice(0, lastAtIndex) +
      `@[${fullName}](${user.id})` +
      textAfterCursor;

    const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionPattern.exec(newValue)) !== null) {
      mentions.push(match[2]);
    }

    onChange(newValue, mentions);
    setShowMentions(false);
    
    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const filteredUsers = users?.filter((user) => {
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return fullName.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      user.email?.toLowerCase().includes(mentionSearch.toLowerCase());
  });

  // Display value with mentions highlighted
  const displayValue = value.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, "@$1");

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleTextChange}
        placeholder={placeholder}
        rows={rows}
      />
      
      {showMentions && filteredUsers && filteredUsers.length > 0 && (
        <div className="absolute z-[100] w-72 bg-popover border border-border rounded-md shadow-lg mt-1 max-h-64 overflow-auto">
          <div className="p-1">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {user.first_name?.charAt(0) || user.email?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {user.first_name || ""} {user.last_name || ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
