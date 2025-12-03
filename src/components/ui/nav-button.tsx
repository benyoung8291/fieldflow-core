import { ReactNode, forwardRef } from "react";
import { NavLink, NavLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavButtonProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}

/**
 * Navigation button component that uses NavLink for proper link behavior.
 * Enables native browser behaviors like right-click "Open in new tab".
 * Supports active state styling via activeClassName.
 */
export const NavButton = forwardRef<HTMLAnchorElement, NavButtonProps>(
  ({ className, activeClassName, to, children, ...props }, ref) => {
    return (
      <NavLink
        ref={ref}
        to={to}
        className={({ isActive }) =>
          cn(className, isActive && activeClassName)
        }
        {...props}
      >
        {children}
      </NavLink>
    );
  }
);

NavButton.displayName = "NavButton";
