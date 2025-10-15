import * as React from "react";
interface TimerProps {
  currentTime: number; // seconds (0-300)
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
  const minutes = Math.floor(currentTime / 60);
  const seconds = Math.floor(currentTime % 60);
  const display = `${minutes}:${String(seconds).padStart(2, "0")}`;
  const isComplete = currentTime >= 300;
  return <div className="text-center">
      <button onClick={onTogglePause} className="text-4xl font-mono font-bold px-6 py-3 rounded-lg transition-all hover:scale-105 bg-background border-2 border-border shadow-lg" aria-label={!isPlaying ? "Resume timer" : "Pause timer"} disabled={isComplete}>
        {isComplete ? <span className="text-primary">Train arrived</span> : <span className={!isPlaying ? "text-muted-foreground" : "text-foreground"}>
            {display}
          </span>}
      </button>
      {!isComplete}
    </div>;
};