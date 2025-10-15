import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

/**
 * TimelineControls: Scrubber and speed selector for playback control
 */
export const TimelineControls: React.FC = () => {
  const { timeSec, setTime } = usePeoplePlaybackStore();
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      <Slider
        value={[timeSec]}
        onValueChange={(v) => setTime(v[0])}
        min={0}
        max={300}
        step={1}
        className="w-full"
      />
    </div>
  );
};
