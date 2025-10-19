import * as React from "react";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface TimerProps {
  currentTime: number;
  isPlaying: boolean;
  onTogglePause: () => void;
}

/**
 * Timer: Displays count-up from 00:00 to 05:00
 * Clicking toggles pause/resume for all animations
 */
export const Timer: React.FC<TimerProps> = ({
  currentTime,
  isPlaying,
  onTogglePause
}) => {
  const { durationSec } = usePeoplePlaybackStore();
  const isComplete = currentTime >= durationSec;
  
  // Wall-clock: 4:56:00 PM to 4:59:00 PM (integer seconds only)
  const t = Math.min(durationSec, Math.max(0, currentTime));
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
    <div className="text-center">
      <button 
        onClick={onTogglePause}
        disabled={isComplete}
        className="text-[18px] md:text-[20px] font-medium leading-none text-foreground cursor-pointer hover:opacity-80 transition-opacity"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isComplete ? "Train arrived" : display}
      </button>
    </div>
  );
};