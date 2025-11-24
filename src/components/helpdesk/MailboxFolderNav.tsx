import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Inbox, 
  Send, 
  FileText, 
  Archive, 
  Trash2, 
  AlertOctagon,
  Star,
  FolderOpen
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Mailbox Folders</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {folderConfig.map((folder) => {
                const Icon = folder.icon;
                const count = counts[folder.id as keyof typeof counts];
                const isSelected = selectedFolder === folder.id;
                
                return (
                  <SidebarMenuItem key={folder.id}>
                    <SidebarMenuButton
                      onClick={() => onSelectFolder(folder.id)}
                      isActive={isSelected}
                      className={cn(
                        "w-full justify-start",
                        isSelected && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{folder.label}</span>
                      {count !== undefined && count > 0 && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                          isSelected 
                            ? "bg-primary/20 text-primary font-semibold" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {count}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
