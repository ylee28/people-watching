import * as React from "react";

interface TimerProps {
  currentTime: number; // seconds (0-300)
  isPaused: boolean;
  onTogglePause: () => void;
}

/**
 * Timer: Displays countdown from 05:00 to 00:00
 * Clicking toggles pause/resume for all animations
 */
export const Timer: React.FC<TimerProps> = ({
  currentTime,
  isPaused,
  onTogglePause,
}) => {
  const remainingTime = Math.max(0, 300 - currentTime);
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isComplete = remainingTime === 0;

  return (
    <div className="text-center">
      <button
        onClick={onTogglePause}
        className="text-4xl font-mono font-bold px-6 py-3 rounded-lg transition-all hover:scale-105 bg-background border-2 border-border shadow-lg"
        aria-label={isPaused ? "Resume timer" : "Pause timer"}
        disabled={isComplete}
      >
        {isComplete ? (
          <span className="text-primary">Train arrived</span>
        ) : (
          <span className={isPaused ? "text-muted-foreground" : "text-foreground"}>
            {display}
          </span>
        )}
      </button>
      {!isComplete && (
        <p className="text-xs text-muted-foreground mt-2">
          {isPaused ? "Paused - Click to resume" : "Click to pause"}
        </p>
      )}
    </div>
  );
};
