import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const location = useLocation();
  const isOnWorkerDashboard = location.pathname === "/worker/dashboard";

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button 
      variant={isOnWorkerDashboard ? "ghost" : "ghost"} 
      size="icon" 
      className={cn(
        "h-7 w-7 rounded-lg mobile-tap transition-colors",
        isOnWorkerDashboard && "text-primary-foreground hover:bg-primary-foreground/15"
      )} 
      onClick={toggleTheme}
      title="Toggle theme"
    >
      <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
