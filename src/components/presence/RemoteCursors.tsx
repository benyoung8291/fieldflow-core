import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PresenceUser {
  userId: string;
  userName: string;
  cursorX?: number;
  cursorY?: number;
}

interface RemoteCursorsProps {
  users: PresenceUser[];
}

const cursorColors = [
  "bg-primary",
  "bg-success",
  "bg-warning",
  "bg-info",
  "bg-secondary",
  "bg-destructive",
];

function getCursorColor(userId: string): string {
  const index = userId.charCodeAt(0) % cursorColors.length;
  return cursorColors[index];
}

export default function RemoteCursors({ users }: RemoteCursorsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {users.map((user) => {
        if (!user.cursorX || !user.cursorY) return null;

        return (
          <div
            key={user.userId}
            className="absolute transition-all duration-75"
            style={{
              left: `${user.cursorX}px`,
              top: `${user.cursorY}px`,
            }}
          >
            {/* Cursor arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={cn("drop-shadow-lg", getCursorColor(user.userId))}
            >
              <path
                d="M5.65376 12.3673L11.6768 6.34425L13.4477 8.11516L10.1869 11.3759L18.2923 13.1188L13.4219 18.0008L11.6768 11.3759L5.65376 12.3673Z"
                fill="currentColor"
              />
            </svg>
            {/* User name label */}
            <div
              className={cn(
                "ml-6 -mt-1 px-2 py-1 rounded text-xs font-medium text-white shadow-lg whitespace-nowrap",
                getCursorColor(user.userId)
              )}
            >
              {user.userName.split(" ")[0]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
