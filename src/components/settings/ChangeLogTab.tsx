import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Info, Sparkles } from "lucide-react";

interface ChangeLogEntry {
  version: string;
  date: string;
  type: "feature" | "improvement" | "fix" | "breaking";
  changes: string[];
}

const changeLog: ChangeLogEntry[] = [
  {
    version: "1.2.0",
    date: "2025-11-09",
    type: "feature",
    changes: [
      "Added user management with role assignment",
      "Added ability to link users to worker profiles",
      "Added admin password reset functionality",
      "Added worker profile linking and unlinking",
    ],
  },
  {
    version: "1.1.0",
    date: "2025-11-09",
    type: "feature",
    changes: [
      "Added customizable navigation menu",
      "Added menu item reordering and folder creation",
      "Added role-based permissions management",
      "Added custom color themes for menu items",
    ],
  },
  {
    version: "1.0.0",
    date: "2025-11-09",
    type: "feature",
    changes: [
      "Initial release with core CRM functionality",
      "Customer and lead management",
      "Quote and project management",
      "Service orders and contracts",
      "Scheduler and appointments",
      "Worker management with availability",
      "Analytics dashboard",
    ],
  },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case "feature":
      return <Sparkles className="h-4 w-4" />;
    case "improvement":
      return <CheckCircle2 className="h-4 w-4" />;
    case "fix":
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
};

const getTypeBadgeVariant = (type: string) => {
  switch (type) {
    case "feature":
      return "default";
    case "improvement":
      return "secondary";
    case "fix":
      return "destructive";
    case "breaking":
      return "outline";
    default:
      return "outline";
  }
};

export const ChangeLogTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Change Log</h3>
        <p className="text-sm text-muted-foreground">
          Recent updates and improvements to the platform
        </p>
      </div>

      <div className="space-y-4">
        {changeLog.map((entry, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">Version {entry.version}</CardTitle>
                  <Badge variant={getTypeBadgeVariant(entry.type)} className="gap-1">
                    {getTypeIcon(entry.type)}
                    {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">{entry.date}</span>
              </div>
              <CardDescription>
                Released on {new Date(entry.date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {entry.changes.map((change, changeIndex) => (
                  <li key={changeIndex} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span className="text-sm">{change}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
