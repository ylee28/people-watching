import * as React from "react";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

/**
 * Timer: Displays count-up from 00:00 to 05:00 (display-only, no interaction)
 */
export const Timer: React.FC = () => {
  const { timeSec, durationSec } = usePeoplePlaybackStore();
  const isComplete = timeSec >= durationSec;
  
  // Wall-clock: 4:56:00 PM to 4:59:00 PM (integer seconds only)
  const t = Math.min(durationSec, Math.max(0, timeSec));
  const tInt = Math.floor(t); // Ensure NO decimals
  
  const start = { h: 16, m: 56, s: 0 }; // 4:56:00 PM in 24h
  const wall = (start.h * 3600 + start.m * 60 + start.s) + tInt;
  
  const hh24 = Math.floor(wall / 3600) % 24;
  const mm = Math.floor((wall % 3600) / 60);
  const ss = wall % 60;
  
  const hh12 = (hh24 % 12) || 12;
  const ampm = hh24 >= 12 ? 'PM' : 'AM';
  const display = `${hh12}:${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')} ${ampm}`;
  
  return (
    <div className="text-center pointer-events-none">
      <span style={{ fontSize: '50pt' }} className="font-beretta text-foreground">
        {isComplete ? "Train arrived" : display}
      </span>
    </div>
  );
};
