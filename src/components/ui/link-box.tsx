import { ReactNode } from "react";
import { Link, LinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LinkBoxProps extends Omit<LinkProps, "className"> {
  className?: string;
  children: ReactNode;
}

/**
 * Generic link wrapper that makes any content into a proper link.
 * Enables native browser behaviors like right-click "Open in new tab".
 */
export function LinkBox({ to, className, children, ...props }: LinkBoxProps) {
  return (
    <Link
      to={to}
      className={cn("block", className)}
      {...props}
    >
      {children}
    </Link>
  );
}
