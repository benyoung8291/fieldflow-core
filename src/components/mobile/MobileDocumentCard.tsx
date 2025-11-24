import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MobileDocumentCardProps {
  title: string;
  subtitle?: string;
  status?: string;
  statusColor?: string;
  metadata?: Array<{ label: string; value: string | ReactNode }>;
  onClick?: () => void;
  to?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

export const MobileDocumentCard = ({
  title,
  subtitle,
  status,
  statusColor,
  metadata,
  onClick,
  to,
  badge,
  badgeVariant = "default",
}: MobileDocumentCardProps) => {
  const content = (
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title and Badge */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-base truncate">{title}</h3>
            {badge && (
              <Badge variant={badgeVariant} className="text-xs">
                {badge}
              </Badge>
            )}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
              {subtitle}
            </p>
          )}

          {/* Status */}
          {status && (
            <div className="flex items-center gap-2 mb-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  statusColor || "bg-muted"
                )}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {status}
              </span>
            </div>
          )}

          {/* Metadata */}
          {metadata && metadata.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {metadata.map((item, index) => (
                <div key={index} className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chevron */}
        {(onClick || to) && (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
        )}
      </div>
    </CardContent>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        <Card
          className={cn(
            "transition-all active:scale-[0.98] cursor-pointer hover:shadow-md"
          )}
        >
          {content}
        </Card>
      </Link>
    );
  }

  return (
    <Card
      className={cn(
        "transition-all active:scale-[0.98]",
        onClick && "cursor-pointer hover:shadow-md"
      )}
      onClick={onClick}
    >
      {content}
    </Card>
  );
};
