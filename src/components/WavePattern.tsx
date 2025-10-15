import * as React from "react";

export const WavePattern: React.FC = () => {
  const [isAnimating, setIsAnimating] = React.useState(true);
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const rings = [1, 2, 3, 4, 5, 6];

  React.useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 10);
    }, 10);

    return () => clearInterval(interval);
  }, [isAnimating]);

  const toggleAnimation = () => {
    setIsAnimating(prev => !prev);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      <button
        onClick={toggleAnimation}
        className="text-4xl font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
        aria-label={isAnimating ? "Pause animation" : "Resume animation"}
      >
        {formatTime(elapsedTime)}
      </button>

      <div className="relative w-[600px] h-[600px] flex items-center justify-center">
        <svg width="600" height="600" viewBox="0 0 600 600" className="absolute">
          {rings.map((ring, index) => {
            const radius = 40 + index * 40;
            const delay = index * 1;
            
            return (
              <circle
                key={ring}
                cx="300"
                cy="300"
                r={radius}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                opacity="0.6"
                className={isAnimating ? "animate-ring-grow" : ""}
                style={{
                  animationDelay: `${delay}s`,
                  animationPlayState: isAnimating ? 'running' : 'paused',
                }}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
