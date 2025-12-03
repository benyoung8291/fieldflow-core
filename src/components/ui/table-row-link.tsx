import { ReactNode } from "react";
import { Link, LinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

interface TableRowLinkProps extends Omit<LinkProps, "className"> {
  className?: string;
  children: ReactNode;
}

/**
 * Table row wrapper that enables proper link behavior for navigable rows.
 * Renders as a <Link> styled as a table row, enabling right-click "Open in new tab".
 */
export function TableRowLink({ to, className, children, ...props }: TableRowLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "table-row border-b border-border hover:bg-muted/50 transition-colors cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
