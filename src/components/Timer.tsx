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
  
  // Wall-clock: 4:56:00 PM to 4:59:00 PM
  const start = { h: 16, m: 56, s: 0 }; // 4:56:00 PM
  const t = Math.min(currentTime, durationSec);
  const totalStartSec = start.h * 3600 + start.m * 60 + start.s;
  const wall = totalStartSec + t;
  const hh = Math.floor(wall / 3600) % 24;
  const mm = Math.floor((wall % 3600) / 60);
  const ss = wall % 60;
  const display = `${((hh % 12) || 12)}:${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')} ${hh >= 12 ? 'PM' : 'AM'}`;
  
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