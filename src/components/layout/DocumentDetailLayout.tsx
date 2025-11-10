import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, FileText } from "lucide-react";

export interface DocumentAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive" | "ghost";
  show?: boolean;
}

export interface FileMenuAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  separator?: boolean;
  destructive?: boolean;
}

export interface StatusBadge {
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

export interface TabConfig {
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
  badge?: string | number;
}

interface DocumentDetailLayoutProps {
  // Header
  title: string;
  subtitle?: string;
  backPath: string;
  statusBadges?: StatusBadge[];
  
  // Toolbar actions
  primaryActions?: DocumentAction[];
  fileMenuActions?: FileMenuAction[];
  
  // Audit (kept for backward compatibility but not used for drawer)
  auditTableName?: string;
  auditRecordId?: string;
  
  // Key information section
  keyInfoSection?: ReactNode;
  
  // Tabs
  tabs: TabConfig[];
  defaultTab?: string;
  
  // Loading state
  isLoading?: boolean;
  notFoundMessage?: string;
}

export default function DocumentDetailLayout({
  title,
  subtitle,
  backPath,
  statusBadges = [],
  primaryActions = [],
  fileMenuActions = [],
  auditTableName,
  auditRecordId,
  keyInfoSection,
  tabs,
  defaultTab,
  isLoading,
  notFoundMessage,
}: DocumentDetailLayoutProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (notFoundMessage) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{notFoundMessage}</p>
          <Button onClick={() => navigate(backPath)} className="mt-4">
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(backPath)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-foreground truncate">
                  {title}
                </h1>
                {statusBadges.map((badge, idx) => (
                  <Badge 
                    key={idx}
                    variant={badge.variant || "outline"}
                    className={badge.className}
                  >
                    {badge.label}
                  </Badge>
                ))}
              </div>
              {subtitle && (
                <p className="text-muted-foreground mt-1 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* File Menu */}
            {fileMenuActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    File
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
                  {fileMenuActions.map((action, idx) => (
                    <div key={idx}>
                      {action.separator && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        onClick={action.onClick}
                        className={action.destructive ? "text-destructive" : ""}
                      >
                        {action.icon && <span className="mr-2">{action.icon}</span>}
                        {action.label}
                      </DropdownMenuItem>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Primary Actions */}
            {primaryActions
              .filter(action => action.show !== false)
              .map((action, idx) => (
                <Button
                  key={idx}
                  onClick={action.onClick}
                  variant={action.variant || "default"}
                  size="sm"
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </Button>
              ))}
          </div>
        </div>

        {/* Key Information Section */}
        {keyInfoSection && (
          <div>{keyInfoSection}</div>
        )}

        {/* Tabs */}
        <Tabs defaultValue={defaultTab || tabs[0]?.value} className="space-y-4">
          <TabsList className="flex-wrap h-auto bg-muted">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <Badge variant="secondary" className="ml-1">
                    {tab.badge}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
