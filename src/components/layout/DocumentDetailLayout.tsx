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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, FileText, MoreVertical } from "lucide-react";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";

export interface DocumentAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive" | "ghost";
  show?: boolean;
  customRender?: ReactNode;
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
  secondaryActions?: DocumentAction[];
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
  secondaryActions = [],
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
  const { isMobile } = useViewMode();

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

  // Mobile Layout
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background pb-20">
          {/* Mobile Header */}
          <div className="sticky top-0 z-20 bg-background border-b">
            <div className="flex items-center gap-3 p-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(backPath)}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold truncate">{title}</h1>
                {subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                )}
              </div>
              {statusBadges[0] && (
                <Badge
                  variant={statusBadges[0].variant || "default"}
                  className={cn("flex-shrink-0 text-xs", statusBadges[0].className)}
                >
                  {statusBadges[0].label}
                </Badge>
              )}
            </div>
          </div>

          {/* Mobile Action Bar */}
          <div className="sticky top-[61px] z-10 bg-background border-b p-3 flex items-center gap-2 overflow-x-auto">
            {primaryActions
              .filter(action => action.show !== false)
              .slice(0, 2)
              .map((action, idx) => (
                <Button
                  key={idx}
                  variant={action.variant || "default"}
                  size="sm"
                  onClick={action.onClick}
                  className="flex-shrink-0"
                >
                  {action.icon}
                  <span className="ml-2">{action.label}</span>
                </Button>
              ))}
            
            {(fileMenuActions.length > 0 || primaryActions.length > 2) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto flex-shrink-0">
                    <FileText className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {primaryActions
                    .filter(action => action.show !== false)
                    .slice(2)
                    .map((action, idx) => (
                      <DropdownMenuItem key={idx} onClick={action.onClick}>
                        {action.icon && <span className="mr-2">{action.icon}</span>}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  {primaryActions.length > 2 && fileMenuActions.length > 0 && (
                    <DropdownMenuSeparator />
                  )}
                  {fileMenuActions.map((action, idx) => (
                    <div key={idx}>
                      {action.separator && idx > 0 && <DropdownMenuSeparator />}
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
          </div>

          {/* Key Info */}
          {keyInfoSection && (
            <div className="p-2">
              {keyInfoSection}
            </div>
          )}

          {/* Sections as Accordion */}
          <div className="px-2 pb-2">
            <Accordion
              type="multiple"
              defaultValue={[defaultTab || tabs[0]?.value]}
              className="space-y-1.5"
            >
              {tabs.map((tab) => (
                <AccordionItem
                  key={tab.value}
                  value={tab.value}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-3 py-2 hover:no-underline">
                    <div className="flex items-center gap-2">
                      {tab.icon}
                      <span className="font-medium text-sm">{tab.label}</span>
                      {tab.badge !== undefined && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {tab.badge}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 pt-0">
                    {tab.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Desktop Layout
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
              .map((action, idx) => 
                action.customRender ? (
                  <div key={idx}>{action.customRender}</div>
                ) : (
                  <Button
                    key={idx}
                    onClick={action.onClick}
                    variant={action.variant || "default"}
                    size="sm"
                  >
                    {action.icon && <span className="mr-2">{action.icon}</span>}
                    {action.label}
                  </Button>
                )
              )}

            {/* Secondary Actions Dropdown */}
            {secondaryActions.filter(action => action.show !== false).length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
                  {secondaryActions
                    .filter(action => action.show !== false)
                    .map((action, idx) => (
                      <DropdownMenuItem
                        key={idx}
                        onClick={action.onClick}
                        className={action.variant === "destructive" ? "text-destructive focus:text-destructive" : ""}
                      >
                        {action.icon && <span className="mr-2">{action.icon}</span>}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
