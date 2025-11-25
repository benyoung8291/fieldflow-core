import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { TicketList } from "@/components/helpdesk/TicketList";
import { TicketTimeline } from "@/components/helpdesk/TicketTimeline";
import { LinkedDocumentsSidebar } from "@/components/helpdesk/LinkedDocumentsSidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";

type MailboxFolder = 
  | "inbox" 
  | "sent" 
  | "drafts" 
  | "archive" 
  | "deleted" 
  | "junk"
  | "starred"
  | "all";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, Filter, Link2, MessageSquare, BarChart3, Menu, Inbox, Send, FileText, Archive, Trash2, AlertOctagon, Star, FolderOpen, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHelpdeskPresence } from "@/hooks/useHelpdeskPresence";

export default function HelpDesk() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterAssignment, setFilterAssignment] = useState<"all" | "unassigned" | "assigned_to_me">("assigned_to_me");
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterArchived, setFilterArchived] = useState<boolean>(false);
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(true);
  const [selectedFolder, setSelectedFolder] = useState<MailboxFolder>("inbox");

  // Track presence for this user showing what ticket they're viewing
  useHelpdeskPresence(selectedTicketId);

  // Fetch current user and their role
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-helpdesk"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, tenant_id")
        .eq("id", user.id)
        .single();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const isAboveWorker = roles?.some(r => 
        r.role === "tenant_admin" || 
        r.role === "supervisor" || 
        r.role === "management"
      );

      return { ...profile, isAboveWorker };
    },
  });

  useEffect(() => {
    // Load last used filter from localStorage
    const lastFilter = localStorage.getItem('helpdeskLastFilter');
    const lastUserId = localStorage.getItem('helpdeskLastUserId');
    
    if (lastFilter && (lastFilter === 'all' || lastFilter === 'unassigned' || lastFilter === 'assigned_to_me')) {
      setFilterAssignment(lastFilter as any);
    } else {
      // Default to "assigned_to_me" to show user's tickets initially
      setFilterAssignment('assigned_to_me');
    }

    if (lastUserId) {
      setFilterUserId(lastUserId);
    } else if (currentUser?.id) {
      setFilterUserId(currentUser.id);
    }
  }, [currentUser?.id]);

  // Handle ticket selection from URL params (e.g., from search)
  // URL is the single source of truth - only sync URL to state
  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (ticketId !== selectedTicketId) {
      if (ticketId) {
        // Check if the ticket is archived and enable filter if needed
        const checkAndSelectTicket = async () => {
          const { data: ticketData } = await supabase
            .from("helpdesk_tickets")
            .select("is_archived")
            .eq("id", ticketId)
            .single();
          
          if (ticketData?.is_archived) {
            setFilterArchived(true);
          }
        };
        
        checkAndSelectTicket();
      }
      setSelectedTicketId(ticketId);
    }
  }, [searchParams.get("ticket")]);

  // Fetch pipelines filtered by user access
  const { data: pipelines } = useQuery({
    queryKey: ["helpdesk-pipelines", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data: allPipelines, error } = await supabase
        .from("helpdesk_pipelines" as any)
        .select("*")
        .order("name");
      
      if (error) throw error;

      // If user is above worker, they can see all pipelines
      if (currentUser.isAboveWorker) {
        return allPipelines as any[];
      }

      // Otherwise, filter to only pipelines the user is assigned to
      const { data: assignments, error: assignError } = await supabase
        .from("helpdesk_pipeline_users" as any)
        .select("pipeline_id")
        .eq("user_id", currentUser.id);

      if (assignError) throw assignError;

      const assignedPipelineIds = new Set(assignments?.map((a: any) => a.pipeline_id) || []);

      // If user has no specific assignments, they can see all pipelines
      if (assignedPipelineIds.size === 0) {
        return allPipelines as any[];
      }

      // Filter to assigned pipelines
      return (allPipelines || []).filter((p: any) => assignedPipelineIds.has(p.id));
    },
    enabled: !!currentUser,
  });

  // Fetch all users for the filter dropdown
  const { data: allUsers } = useQuery({
    queryKey: ["helpdesk-all-users"],
    queryFn: async () => {
      if (!currentUser) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("tenant_id", currentUser.tenant_id)
        .order("first_name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentUser,
  });

  // Load last selected pipeline from localStorage
  useEffect(() => {
    if (pipelines && pipelines.length > 0) {
      const lastPipelineId = localStorage.getItem('helpdeskLastPipeline');
      if (lastPipelineId && lastPipelineId !== 'all') {
        // Verify the pipeline still exists
        const pipelineExists = pipelines.some(p => p.id === lastPipelineId);
        if (pipelineExists) {
          setSelectedPipelineId(lastPipelineId);
        }
      }
    }
  }, [pipelines]);

  // Save selected pipeline and filters to localStorage when they change
  useEffect(() => {
    if (selectedPipelineId !== null) {
      localStorage.setItem('helpdeskLastPipeline', selectedPipelineId);
    } else {
      localStorage.setItem('helpdeskLastPipeline', 'all');
    }
  }, [selectedPipelineId]);

  useEffect(() => {
    localStorage.setItem('helpdeskLastFilter', filterAssignment);
  }, [filterAssignment]);

  useEffect(() => {
    if (filterUserId) {
      localStorage.setItem('helpdeskLastUserId', filterUserId);
    }
  }, [filterUserId]);

  const { data: emailAccounts } = useQuery({
    queryKey: ["helpdesk-email-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_email_accounts" as any)
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: ticket } = useQuery({
    queryKey: ["helpdesk-ticket", selectedTicketId],
    queryFn: async () => {
      if (!selectedTicketId) return null;
      
      const { data, error } = await supabase
        .from("helpdesk_tickets" as any)
        .select(`
          *,
          customer:customers(id, name),
          contact:contacts(id, first_name, last_name, email),
          assigned_user:profiles!helpdesk_tickets_assigned_to_fkey(id, first_name, last_name),
          email_account:helpdesk_email_accounts(id, email_address)
        `)
        .eq("id", selectedTicketId)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!selectedTicketId,
  });

  const handleSelectTicket = (ticketId: string) => {
    // Update URL first - this is the source of truth
    setSearchParams({ ticket: ticketId }, { replace: true });
    
    // Mark ticket as read in background (fire and forget)
    supabase
      .from("helpdesk_tickets")
      .update({ is_read: true })
      .eq("id", ticketId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      });
    
    // Also mark as read in Microsoft (fire and forget)
    supabase.functions.invoke("microsoft-mark-read", {
      body: { ticketId }
    });
  };

  const handleSyncEmails = async () => {
    if (!emailAccounts || emailAccounts.length === 0) {
      toast({
        title: "No email accounts",
        description: "Please connect email accounts in settings first",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    
    // Refetch email accounts first to get latest IDs
    await queryClient.invalidateQueries({ queryKey: ["helpdesk-email-accounts-active"] });
    const freshAccounts = await queryClient.fetchQuery({
      queryKey: ["helpdesk-email-accounts-active"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("helpdesk_email_accounts" as any)
          .select("*")
          .eq("is_active", true);
        if (error) throw error;
        return data as any[];
      },
    });
    
    if (!freshAccounts || freshAccounts.length === 0) {
      toast({
        title: "No active email accounts",
        description: "Please check your email account settings",
        variant: "destructive",
      });
      setIsSyncing(false);
      return;
    }
    
    try {
      let totalSynced = 0;
      
      for (const account of freshAccounts) {
        // Sync inbox
        const { data: inboxData, error: inboxError } = await supabase.functions.invoke(
          "microsoft-sync-emails",
          {
            body: { emailAccountId: account.id },
          }
        );

        if (inboxError) throw inboxError;
        totalSynced += inboxData.syncedCount || 0;

        // Sync archive if viewing archived
        if (filterArchived) {
          const { data: archiveData, error: archiveError } = await supabase.functions.invoke(
            "microsoft-sync-archived-emails",
            {
              body: { emailAccountId: account.id },
            }
          );

          if (archiveError) throw archiveError;
          totalSynced += archiveData.syncedCount || 0;
        }
      }

      toast({
        title: "Email sync complete",
        description: `Synced ${totalSynced} new tickets`,
      });

      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    } catch (error: any) {
      toast({
        title: "Failed to sync emails",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Set up realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('helpdesk-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'helpdesk_tickets'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
          if (selectedTicketId) {
            queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", selectedTicketId] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'helpdesk_messages'
        },
        () => {
          if (selectedTicketId) {
            queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", selectedTicketId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicketId, queryClient]);

  const folderConfig = [
    { id: "all" as const, label: "All Mail", icon: FolderOpen },
    { id: "inbox" as const, label: "Inbox", icon: Inbox },
    { id: "starred" as const, label: "Starred", icon: Star },
    { id: "sent" as const, label: "Sent", icon: Send },
    { id: "drafts" as const, label: "Drafts", icon: FileText },
    { id: "archive" as const, label: "Archive", icon: Archive },
    { id: "junk" as const, label: "Junk", icon: AlertOctagon },
    { id: "deleted" as const, label: "Deleted", icon: Trash2 },
  ];

  const currentFolderConfig = folderConfig.find(f => f.id === selectedFolder) || folderConfig[1];
  const CurrentFolderIcon = currentFolderConfig.icon;

  return (
    <DashboardLayout disablePresence={false} noPadding={true}>
      <div className="flex flex-col h-full">
        {/* Header with Pipeline Selector, Quick Filters, and Sync */}
        <div className="flex items-center justify-between px-2 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-2 px-3">
                  <CurrentFolderIcon className="h-4 w-4" />
                  <span className="font-medium">{currentFolderConfig.label}</span>
                  <Menu className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Mailbox Folders</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {folderConfig.map((folder) => {
                  const Icon = folder.icon;
                  const isSelected = selectedFolder === folder.id;
                  return (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={() => {
                        setSelectedFolder(folder.id);
                        setFilterArchived(folder.id === "archive" || folder.id === "deleted" || folder.id === "junk");
                      }}
                      className="gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{folder.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold text-foreground">Help Desk</h1>
            
          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant={filterAssignment === "assigned_to_me" ? "default" : "ghost"}
              size="sm"
              className="h-8 text-sm"
              onClick={() => {
                setFilterAssignment("assigned_to_me");
                if (currentUser?.id) {
                  setFilterUserId(currentUser.id);
                }
                localStorage.setItem('helpdeskLastFilter', 'assigned_to_me');
              }}
            >
              My Tickets
            </Button>
            <Button
              variant={filterAssignment === "unassigned" ? "default" : "ghost"}
              size="sm"
              className="h-8 text-sm"
              onClick={() => {
                setFilterAssignment("unassigned");
                setFilterUserId(null);
                localStorage.setItem('helpdeskLastFilter', 'unassigned');
              }}
            >
              Unassigned
            </Button>
            <Button
              variant={filterAssignment === "all" ? "default" : "ghost"}
              size="sm"
              className="h-8 text-sm"
              onClick={() => {
                setFilterAssignment("all");
                setFilterUserId(null);
                localStorage.setItem('helpdeskLastFilter', 'all');
              }}
            >
              All
            </Button>
            
            {/* User Filter Dropdown */}
            <Select 
              value={filterUserId || "none"} 
              onValueChange={(value) => {
                if (value === "none") {
                  setFilterUserId(null);
                } else {
                  setFilterUserId(value);
                  setFilterAssignment("all");
                }
              }}
            >
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All Users</SelectItem>
                {allUsers?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
            
          <Select value={selectedPipelineId || "all"} onValueChange={(value) => setSelectedPipelineId(value === "all" ? null : value)}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder="All Pipelines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pipelines</SelectItem>
              {pipelines?.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: pipeline.color }} />
                    {pipeline.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-sm">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Assignment</Label>
                  <Select value={filterAssignment} onValueChange={(value: any) => setFilterAssignment(value)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tickets</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      <SelectItem value="assigned_to_me">Assigned to Me</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show Archived</Label>
                  <Switch checked={filterArchived} onCheckedChange={setFilterArchived} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/helpdesk/analytics')} variant="outline" size="sm" className="h-8 text-sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button onClick={handleSyncEmails} disabled={isSyncing} size="sm" className="h-8 text-sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync"}
          </Button>
        </div>
      </div>

        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
          {/* Ticket List */}
          <ResizablePanel defaultSize={28} minSize={20} maxSize={40} className="relative">
            <TicketList
              selectedTicketId={selectedTicketId} 
              onSelectTicket={handleSelectTicket}
              pipelineId={selectedPipelineId}
              filterAssignment={filterAssignment}
              filterUserId={filterUserId}
              filterArchived={filterArchived}
              selectedFolder={selectedFolder}
            />
          </ResizablePanel>

          <ResizableHandle withHandle className="hover:bg-primary/20 transition-colors w-1" />

          {/* Middle: Timeline View */}
          <ResizablePanel defaultSize={47} minSize={35} className="relative bg-muted/20">
            {selectedTicketId ? (
              <TicketTimeline ticketId={selectedTicketId} ticket={ticket} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4 px-8 max-w-md animate-fade-in">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto">
                    <MessageSquare className="h-10 w-10 text-primary/40" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-foreground">No ticket selected</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Select a ticket from the list to view its conversation and details
                    </p>
                  </div>
                </div>
              </div>
            )}
          </ResizablePanel>

          {sidebarVisible && <ResizableHandle withHandle className="hover:bg-primary/20 transition-colors w-1" />}

          {/* Right: Linked Documents */}
          {sidebarVisible && (
            <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="relative bg-background">
              {selectedTicketId ? (
                <LinkedDocumentsSidebar 
                  ticketId={selectedTicketId} 
                  ticket={ticket}
                  onClose={() => setSidebarVisible(false)}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="text-center space-y-3 animate-fade-in">
                    <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                      <Link2 className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Linked documents will appear here
                    </p>
                  </div>
                </div>
              )}
            </ResizablePanel>
          )}
          
          {/* Reopen sidebar button */}
          {!sidebarVisible && selectedTicketId && (
            <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
              <Button
                onClick={() => setSidebarVisible(true)}
                size="lg"
                className="shadow-2xl hover:shadow-2xl transition-all hover-lift h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/50 font-semibold"
              >
                <Link2 className="h-5 w-5 mr-2" />
                Show Links
              </Button>
            </div>
          )}
        </ResizablePanelGroup>
      </div>
    </DashboardLayout>
  );
}
