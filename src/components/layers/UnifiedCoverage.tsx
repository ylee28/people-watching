import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedCoverageProps {
  size?: number;
}

type LifecycleState = 'entering' | 'active' | 'exiting' | 'gone';

interface PersonAnimation {
  life: LifecycleState;
  enterTween?: { fromR: number; toR: number; t: number; dur: number; opacity: number };
  exitTween?: { fromR: number; toR: number; t: number; dur: number; opacity: number };
}

/**
 * Layer 5: Coverage - Shows accumulated footprint of where dots have been
 */
export const UnifiedCoverage: React.FC<UnifiedCoverageProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  const isPlaying = usePeoplePlaybackStore((state) => state.isPlaying);
  
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const lastTimeRef = React.useRef<number>(0);
  const lastPositionsRef = React.useRef<Map<string, { x: number; y: number }>>(new Map());
  const [animations, setAnimations] = React.useState<Map<string, PersonAnimation>>(new Map());
  const rafRef = React.useRef<number>(0);
  const lastFrameTimeRef = React.useRef<number>(performance.now());
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Animate enter/exit
  React.useEffect(() => {
    const animate = (now: number) => {
      const dtSec = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      
      if (dtSec > 0 && dtSec < 0.1) {
        setAnimations((prev) => {
          const next = new Map(prev);
          
          peopleAtTime.forEach((person) => {
            const anim = next.get(person.id) || { life: 'entering' };
            const isExiting = person.currentRadiusFactor > 1.0;
            
            if (isExiting && anim.life !== 'exiting' && anim.life !== 'gone') {
              // Start exit - stop stamping
              anim.life = 'exiting';
              anim.exitTween = {
                fromR: person.currentRadiusFactor,
                toR: 1.06,
                t: 0,
                dur: 0.6,
                opacity: 1
              };
              anim.enterTween = undefined;
            } else if (!isExiting && anim.life === 'entering') {
              // Continue or start enter
              if (!anim.enterTween) {
                const enterStartR = Math.max(1.06, person.currentRadiusFactor + 0.12);
                anim.enterTween = {
                  fromR: enterStartR,
                  toR: person.currentRadiusFactor,
                  t: 0,
                  dur: 0.35,
                  opacity: 0
                };
              }
              
              // Advance enter tween
              anim.enterTween.t = Math.min(anim.enterTween.t + dtSec, anim.enterTween.dur);
              anim.enterTween.toR = person.currentRadiusFactor; // track target
              const k = anim.enterTween.t / anim.enterTween.dur;
              const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
              anim.enterTween.opacity = e;
              
              if (anim.enterTween.t >= anim.enterTween.dur) {
                anim.life = 'active';
                anim.enterTween = undefined;
              }
            } else if (anim.life === 'exiting' && anim.exitTween) {
              // Advance exit tween
              anim.exitTween.t = Math.min(anim.exitTween.t + dtSec, anim.exitTween.dur);
              const k = anim.exitTween.t / anim.exitTween.dur;
              
              if (anim.exitTween.t >= anim.exitTween.dur) {
                anim.life = 'gone';
              }
            }
            
            next.set(person.id, anim);
          });
          
          // Remove gone people
          Array.from(next.keys()).forEach(id => {
            const anim = next.get(id);
            if (anim?.life === 'gone') {
              next.delete(id);
            }
          });
          
          return next;
        });
      }
      
      rafRef.current = requestAnimationFrame(animate);
    };
    
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [peopleAtTime]);

  // Clear canvas when time rewinds to 0
  React.useEffect(() => {
    if (timeSec < lastTimeRef.current || timeSec === 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, size, size);
          lastPositionsRef.current.clear();
        }
      }
    }
    lastTimeRef.current = timeSec;
  }, [timeSec, size]);

  // Stamp footprints on canvas (only when active)
  React.useEffect(() => {
    if (!isPlaying) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Stamp a circle for each visible person at their current position
    peopleAtTime
      .filter((person) => person.isVisible)
      .forEach((person) => {
        const anim = animations.get(person.id);
        
        // Only stamp if active (not entering or exiting)
        if (anim?.life !== 'active') return;
        
        const coord = polarToCartesian(
          center,
          center,
          maxRadius * person.currentRadiusFactor,
          person.currentAngleDeg
        );

        // Only stamp if position changed significantly (avoid over-stamping)
        const lastPos = lastPositionsRef.current.get(person.id);
        if (lastPos) {
          const dist = Math.sqrt(
            Math.pow(coord.x - lastPos.x, 2) + Math.pow(coord.y - lastPos.y, 2)
          );
          if (dist < 2) return; // Skip if moved less than 2px
        }

        // Stamp a small semi-transparent circle
        ctx.fillStyle = hexToRgba(person.color, 0.08);
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Update last position
        lastPositionsRef.current.set(person.id, { x: coord.x, y: coord.y });
      });
  }, [peopleAtTime, isPlaying, center, maxRadius, animations]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      
      {/* Off-screen canvas for footprint accumulation */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ pointerEvents: "none" }}
      />
    </div>
  );
};
