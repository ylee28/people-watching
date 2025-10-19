import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { motion } from "framer-motion";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedMovementProps {
  size?: number;
}

type LifecycleState = 'entering' | 'active' | 'exiting' | 'gone';

interface PersonAnimation {
  life: LifecycleState;
  enterTween?: { fromR: number; toR: number; t: number; dur: number; opacity: number };
  exitTween?: { fromR: number; toR: number; t: number; dur: number; opacity: number };
}

// Helper: get traveled subpath for current time
const getTraveledSubpath = (
  pathHistory: { angleDeg: number; radiusFactor: number; t: number }[],
  center: number,
  maxRadius: number
): string => {
  if (pathHistory.length === 0) return "";
  
  const coords = pathHistory.map((pt) =>
    polarToCartesian(center, center, maxRadius * pt.radiusFactor, pt.angleDeg)
  );
  
  return coords
    .map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`))
    .join(" ");
};

/**
 * Layer 4: Movement Paths - Shows moving dots with dotted trails
 */
export const UnifiedMovement: React.FC<UnifiedMovementProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const isPlaying = usePeoplePlaybackStore((state) => state.isPlaying);
  
  const [animations, setAnimations] = React.useState<Map<string, PersonAnimation>>(new Map());
  const rafRef = React.useRef<number>(0);
  const lastFrameTimeRef = React.useRef<number>(performance.now());
  
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Animate enter/exit
  React.useEffect(() => {
    const animate = (now: number) => {
      const dtSec = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      
      if (dtSec > 0 && dtSec < 0.1) {
        setAnimations((prev) => {
          const next = new Map(prev);
          
          peopleAtTime
            .filter((person) => person.pathHistory.length > 0)
            .forEach((person) => {
              const anim = next.get(person.id) || { life: 'entering' };
              const isExiting = person.currentRadiusFactor > 1.0;
              
              if (isExiting && anim.life !== 'exiting' && anim.life !== 'gone') {
                // Start exit
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
                const e = Math.pow(k, 3); // easeInCubic
                anim.exitTween.opacity = 1 - k;
                
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

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        {peopleAtTime
          .filter((person) => person.isVisible && person.pathHistory.length > 0)
          .map((person) => {
            const anim = animations.get(person.id);
            if (anim?.life === 'gone') return null;
            
            let renderR = person.currentRadiusFactor;
            let opacity = 1;
            
            if (anim?.enterTween) {
              const k = anim.enterTween.t / anim.enterTween.dur;
              const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
              renderR = anim.enterTween.fromR + (anim.enterTween.toR - anim.enterTween.fromR) * e;
              opacity = anim.enterTween.opacity;
            } else if (anim?.exitTween) {
              const k = anim.exitTween.t / anim.exitTween.dur;
              const e = Math.pow(k, 3); // easeInCubic
              renderR = anim.exitTween.fromR + (anim.exitTween.toR - anim.exitTween.fromR) * e;
              opacity = anim.exitTween.opacity;
            }
            
            // Current position with animation
            const currCoord = polarToCartesian(
              center,
              center,
              maxRadius * renderR,
              person.currentAngleDeg
            );

            // Traveled path (only show during active/exiting, fade during enter)
            const traveledPath = getTraveledSubpath(person.pathHistory, center, maxRadius);
            const trailOpacity = anim?.life === 'entering' ? opacity * 0.3 : 0.85;

            return (
              <g key={person.id}>
                {/* Dotted trail (traveled portion only) */}
                {traveledPath && anim?.life !== 'entering' && (
                  <path
                    d={traveledPath}
                    fill="none"
                    stroke={person.color}
                    strokeWidth="3"
                    strokeDasharray="6 8"
                    opacity={trailOpacity * opacity}
                    strokeLinecap="round"
                  />
                )}

                {/* Moving dot (pulsing if playing) */}
                <motion.circle
                  cx={currCoord.x}
                  cy={currCoord.y}
                  r="6"
                  fill={person.color}
                  opacity={opacity}
                  animate={isPlaying && anim?.life === 'active' ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                  transition={{ repeat: isPlaying && anim?.life === 'active' ? Infinity : 0, duration: 1.5 }}
                />
              </g>
            );
          })}
      </svg>
    </div>
  );
};
