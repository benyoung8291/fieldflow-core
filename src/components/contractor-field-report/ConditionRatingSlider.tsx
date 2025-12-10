import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface ConditionRatingSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function ConditionRatingSlider({ label, value, onChange }: ConditionRatingSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        <span className="text-sm font-medium">{value}/5</span>
      </div>
      <div className="relative">
        {/* Gradient background track - Red (Poor) to Green (Excellent) */}
        <div 
          className="absolute inset-x-0 h-2 rounded-full top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ 
            background: 'linear-gradient(to right, hsl(0 84% 60%), hsl(25 95% 53%), hsl(48 96% 53%), hsl(84 81% 44%), hsl(142 71% 45%))' 
          }}
        />
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={1}
          max={5}
          step={1}
          className="relative [&_[data-radix-slider-track]]:bg-transparent [&_[data-radix-slider-range]]:bg-transparent"
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="text-destructive font-medium">Poor</span>
        <span className="text-green-600 font-medium">Excellent</span>
      </div>
    </div>
  );
}
