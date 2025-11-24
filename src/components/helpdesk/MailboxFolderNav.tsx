import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { 
  Inbox, 
  Send, 
  FileText, 
  Archive, 
  Trash2, 
  AlertOctagon,
  Star,
  FolderOpen,
  ChevronRight
} from "lucide-react";
import { useState } from "react";

export type MailboxFolder = 
  | "inbox" 
  | "sent" 
  | "drafts" 
  | "archive" 
  | "deleted" 
  | "junk"
  | "starred"
  | "all";

interface MailboxFolderNavProps {
  selectedFolder: MailboxFolder;
  onSelectFolder: (folder: MailboxFolder) => void;
  counts?: {
    inbox?: number;
    sent?: number;
    drafts?: number;
    archive?: number;
    deleted?: number;
    junk?: number;
    starred?: number;
  };
}

const folderConfig: Array<{
  id: MailboxFolder;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "all", label: "All Mail", icon: FolderOpen },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "junk", label: "Junk", icon: AlertOctagon },
  { id: "deleted", label: "Deleted", icon: Trash2 },
];

export function MailboxFolderNav({ 
  selectedFolder, 
  onSelectFolder,
  counts = {}
}: MailboxFolderNavProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="h-full border-r bg-muted/20">
      <div className="p-3 border-b bg-background/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 px-2"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ChevronRight className={cn(
            "h-4 w-4 mr-2 transition-transform",
            isExpanded && "rotate-90"
          )} />
          <span className="font-semibold text-sm">Folders</span>
        </Button>
      </div>
      {isExpanded && (
        <ScrollArea className="h-[calc(100%-52px)]">
          <div className="p-2 space-y-1">
            {folderConfig.map((folder) => {
              const Icon = folder.icon;
              const count = counts[folder.id as keyof typeof counts];
              const isSelected = selectedFolder === folder.id;
              
              return (
                <Button
                  key={folder.id}
                  variant={isSelected ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start h-9 px-3 text-sm font-normal",
                    isSelected && "bg-secondary font-medium"
                  )}
                  onClick={() => onSelectFolder(folder.id)}
                >
                  <Icon className={cn(
                    "h-4 w-4 mr-2.5",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="flex-1 text-left">{folder.label}</span>
                  {count !== undefined && count > 0 && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                      isSelected 
                        ? "bg-primary/10 text-primary font-semibold" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
