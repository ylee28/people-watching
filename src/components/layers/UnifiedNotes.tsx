import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { useNavigate } from "react-router-dom";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

interface UnifiedNotesProps {
  size?: number;
}

type LifecycleState = 'entering' | 'active' | 'exiting' | 'gone';

interface PersonAnimation {
  life: LifecycleState;
  enterTween?: { fromR: number; toR: number; t: number; dur: number; opacity: number };
  exitTween?: { fromR: number; toR: number; t: number; dur: number; opacity: number };
}

/**
 * Layer 3: Notes - Shows all 13 people with text observations
 */
export const UnifiedNotes: React.FC<UnifiedNotesProps> = ({ size = 520 }) => {
  const navigate = useNavigate();
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
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
            .filter((person) => person.words)
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
        <g>
          {peopleAtTime
            .filter((person) => person.isVisible && person.words)
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
              
              const coord = polarToCartesian(
                center,
                center,
                maxRadius * renderR,
                person.currentAngleDeg
              );
              const isHovered = hoveredId === person.id;

              // Truncate text for display
              const displayText = person.words.length > 15 
                ? person.words.substring(0, 15) + "..." 
                : person.words;

              return (
                <g key={person.id} opacity={opacity}>
                  <text
                    x={coord.x}
                    y={coord.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isHovered ? "11" : "10"}
                    fill="hsl(var(--foreground))"
                    style={{ cursor: "pointer", maxWidth: "80px" }}
                    onMouseEnter={() => setHoveredId(person.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => navigate(`/person/${person.id}`)}
                  >
                    {displayText}
                  </text>
                  {isHovered && (
                    <g>
                      <rect
                        x={coord.x - 60}
                        y={coord.y + 15}
                        width={120}
                        height={40}
                        fill="rgba(0,0,0,0.9)"
                        rx="4"
                      />
                      <text
                        x={coord.x}
                        y={coord.y + 35}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize="10"
                      >
                        {person.words}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
};
