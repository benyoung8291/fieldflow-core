import { ReactNode } from "react";
import { useBrandColors } from "@/hooks/useBrandColors";

interface BrandColorsProviderProps {
  children: ReactNode;
}

export function BrandColorsProvider({ children }: BrandColorsProviderProps) {
  // Load and apply brand colors
  useBrandColors();
  
  return <>{children}</>;
}
