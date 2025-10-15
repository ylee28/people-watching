import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

/**
 * TimelineControls: Scrubber and speed selector for playback control
 */
export const TimelineControls: React.FC = () => {
  const { timeSec, setTime, speed, setSpeed } = usePeoplePlaybackStore();
  
  const speeds = [0.25, 0.5, 1, 2, 4, 8];
  
  // Keyboard controls
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't interfere with text inputs
      }
      
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setTime(timeSec - (e.shiftKey ? 5 : 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          setTime(timeSec + (e.shiftKey ? 5 : 1));
          break;
        case "Home":
          e.preventDefault();
          setTime(0);
          break;
        case "End":
          e.preventDefault();
          setTime(300);
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [timeSec, setTime]);
  
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-2xl mx-auto">
      {/* Scrubber */}
      <div className="w-full flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-mono w-12 text-right">
          {Math.floor(timeSec / 60)}:{String(timeSec % 60).padStart(2, "0")}
        </span>
        <Slider
          value={[timeSec]}
          onValueChange={(v) => setTime(v[0])}
          min={0}
          max={300}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground font-mono w-12">5:00</span>
      </div>
      
      {/* Speed selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Speed:</span>
        {speeds.map((s) => (
          <Button
            key={s}
            variant={speed === s ? "default" : "outline"}
            size="sm"
            onClick={() => setSpeed(s)}
            className="h-7 px-2 text-xs min-w-[48px]"
          >
            {s}×
          </Button>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Use ← → to scrub (Shift for ±5s), Home/End to jump
      </p>
    </div>
  );
};
