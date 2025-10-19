import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// ====== DEBUG SWITCH ======
(window as any).DEBUG_DWELL = true;
const dlog = (...a: any[]) => { if ((window as any).DEBUG_DWELL) console.log('[DWELL]', ...a); };

// ====== CONSTANTS ======
const DWELL_DEFAULT_DIAM = 10;   // px
const DWELL_GROW_DIAM_PS = 10;   // px per second
const DWELL_STROKE = 2;

// ====== TYPES (JSON Schedule) ======
type MotionInterval = { 
  interval: string; 
  tA: number; 
  tB: number; 
  STILL: string[]; 
  MOVING: string[] 
};
type MotionSchedule = { motionSchedule: MotionInterval[] };
type DwellState = { lastIntervalKey?: string; diamPx: number };

// ====== STATE (PERSISTENT) ======
const dwellStates = new Map<string, DwellState>();

// ====== HELPERS ======
const canonicalId = (id: string) => String(id).trim().toUpperCase();

/**
 * Get current motion interval at timeSec using [tA, tB) logic.
 */
function getCurrentInterval(timeSec: number, schedule: MotionInterval[]): MotionInterval | null {
  for (const iv of schedule) {
    if (timeSec >= iv.tA && timeSec < iv.tB) return iv;
  }
  // Clamp to last interval if beyond
  return schedule.length > 0 ? schedule[schedule.length - 1] : null;
}

/**
 * Check if a person is in the STILL list for the current interval.
 */
function isPersonStill(personId: string, interval: MotionInterval | null): boolean {
  if (!interval) return false;
  const id = canonicalId(personId);
  return interval.STILL.some(p => canonicalId(p) === id);
}

/**
 * Update dwell layer for all people using JSON motion schedule.
 * MOVING interval: diameter = 10px
 * STILL interval: diameter grows +10px/sec (unbounded), continues across consecutive STILL
 */
function updateDwellLayer(
  timeSec: number, 
  dtSec: number, 
  schedule: MotionInterval[], 
  personIds: string[]
) {
  const currentInterval = getCurrentInterval(timeSec, schedule);
  if (!currentInterval) return;

  const intervalKey = `${currentInterval.tA}-${currentInterval.tB}`;

  for (const rawId of personIds) {
    const id = canonicalId(rawId);
    const s = dwellStates.get(id) ?? { diamPx: DWELL_DEFAULT_DIAM };
    const isStill = isPersonStill(rawId, currentInterval);

    // On entering new interval
    if (s.lastIntervalKey !== intervalKey) {
      s.lastIntervalKey = intervalKey;
      // Reset to baseline only for MOVING state (keep growing if still STILL)
      if (!isStill) {
        s.diamPx = DWELL_DEFAULT_DIAM;
      }
      
      if (id === 'P01') {
        dlog('🔄 ENTER', id, `[${currentInterval.tA}-${currentInterval.tB})`, isStill ? 'STILL' : 'MOVING', `diam=${s.diamPx.toFixed(1)}px`, currentInterval.interval);
      }
    }

    // Apply growth rule
    if (isStill) {
      s.diamPx += DWELL_GROW_DIAM_PS * dtSec; // +10px per second (unbounded)
    } else {
      s.diamPx = DWELL_DEFAULT_DIAM; // locked at 10px during MOVING
    }

    dwellStates.set(id, s);

    // Debug P01 periodically
    if (id === 'P01' && Math.random() < 0.05) {
      dlog('timeSec', timeSec.toFixed(1), 'interval', `${currentInterval.tA}-${currentInterval.tB}`, 'motion', isStill ? 'STILL' : 'MOVING', 'diam', s.diamPx.toFixed(1));
    }
  }
}

interface UnifiedDwellProps {
  size?: number;
}

/**
 * Layer 2: Dwell Time - JSON motion schedule driven.
 * Shows growing rings around stationary people (STILL state).
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);
  
  const [lastFrameTime, setLastFrameTime] = React.useState(0);
  const [schedule, setSchedule] = React.useState<MotionInterval[]>([]);

  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Load motion schedule from JSON (once)
  React.useEffect(() => {
    fetch('/data/motion_schedule.json')
      .then(res => res.json())
      .then((data: MotionSchedule) => {
        setSchedule(data.motionSchedule);
        dlog('✅ Motion schedule loaded:', data.motionSchedule.length, 'intervals');
        dlog('First interval:', data.motionSchedule[0]);
        dlog('Last interval:', data.motionSchedule[data.motionSchedule.length - 1]);
      })
      .catch(err => console.error('Failed to load motion schedule:', err));
  }, []);

  // Setup dev helpers and visual probe (once)
  React.useEffect(() => {
    // Dev helpers (global)
    (window as any).jumpTo = (t: number) => {
      const state = usePeoplePlaybackStore.getState();
      const clamped = Math.max(0, Math.min(state.durationSec ?? 0, t));
      usePeoplePlaybackStore.setState({ timeSec: clamped });
      console.log('[TIME] ⏭️  Jumped to', clamped, 'seconds');
    };
    (window as any).start = () => (window as any).jumpTo(0);
    (window as any).mid = () => (window as any).jumpTo(90);
    (window as any).end = () => (window as any).jumpTo(usePeoplePlaybackStore.getState().durationSec ?? 180);

    // Keyboard shortcut: R to rewind
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') (window as any).start();
    };
    window.addEventListener('keydown', handleKeydown);

    // Visual probe overlay
    const probeEl = document.createElement('div');
    probeEl.id = 'dwell-probe';
    probeEl.style.cssText = 'position:fixed;left:16px;bottom:16px;background:rgba(0,0,0,.8);color:#0f0;padding:8px 12px;border-radius:6px;font:11px/1.4 "Courier New",monospace;pointer-events:none;z-index:9999;border:1px solid #0f0;max-width:320px';
    document.body.appendChild(probeEl);

    return () => {
      const existing = document.getElementById('dwell-probe');
      if (existing) existing.remove();
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  // Update dwell states every frame (driven by global timeSec)
  React.useEffect(() => {
    if (schedule.length === 0) return;

    const dtSec = lastFrameTime > 0 ? Math.max(0, timeSec - lastFrameTime) : 0;
    setLastFrameTime(timeSec);

    // Get all person IDs from peopleAtTime (visible + invisible)
    const personIds = Object.keys(usePeoplePlaybackStore.getState().peopleAtTime);
    updateDwellLayer(timeSec, dtSec, schedule, personIds);

    // Update visual probe
    const probeEl = document.getElementById('dwell-probe');
    if (probeEl) {
      const currentInterval = getCurrentInterval(timeSec, schedule);
      if (!currentInterval) return;

      const stillCount = currentInterval.STILL.length;
      const movingCount = currentInterval.MOVING.length;
      const mm = Math.floor(timeSec / 60);
      const ss = Math.floor(timeSec % 60);
      
      const p01Still = isPersonStill('P01', currentInterval);
      const p01State = dwellStates.get('P01');
      
      const growingPeople = Array.from(dwellStates.entries())
        .filter(([_, s]) => s.diamPx > DWELL_DEFAULT_DIAM + 1)
        .sort((a, b) => b[1].diamPx - a[1].diamPx)
        .slice(0, 4);
      
      probeEl.innerHTML = `<strong>Dwell (${stillCount} STILL, ${movingCount} MOVING)</strong><br/>` +
        `time: ${mm}:${ss.toString().padStart(2,'0')} (${timeSec.toFixed(1)}s)<br/>` +
        `interval: ${currentInterval.interval}<br/>` +
        (p01State ? 
          `P01: <strong>${p01Still ? 'STILL' : 'MOVING'}</strong> ${p01State.diamPx.toFixed(1)}px<br/>` : '') +
        (growingPeople.length > 0 ? 
          `Growing: ${growingPeople.map(([id, s]) => `${id}:${s.diamPx.toFixed(0)}px`).join(', ')}` : 
          'No one growing');
    }

    // Log periodic summary
    if ((window as any).DEBUG_DWELL && Math.floor(timeSec) !== Math.floor(lastFrameTime) && Math.floor(timeSec) % 10 === 0) {
      const iv = getCurrentInterval(timeSec, schedule);
      if (iv) {
        dlog(`⏱️  t=${timeSec.toFixed(1)}s: ${iv.STILL.length} STILL, ${iv.MOVING.length} MOVING`);
      }
    }
  }, [timeSec, lastFrameTime, schedule]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        <g>
          {peopleAtTime
            .filter((person) => person.isVisible)
            .map((person) => {
              const coord = polarToCartesian(
                center,
                center,
                maxRadius * person.currentRadiusFactor,
                person.currentAngleDeg
              );

              const canId = canonicalId(person.id);
              const state = dwellStates.get(canId);
              const ringDiameter = state?.diamPx || DWELL_DEFAULT_DIAM;
              const ringRadius = ringDiameter / 2; // IMPORTANT: SVG circle uses radius, not diameter

              if (ringRadius <= 0) return null;

              return (
                <circle
                  key={person.id}
                  id={`dwell-${canId}`}
                  cx={coord.x}
                  cy={coord.y}
                  r={ringRadius}
                  fill="none"
                  stroke={person.color}
                  strokeWidth={DWELL_STROKE}
                  strokeOpacity="0.9"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
        </g>
      </svg>
    </div>
  );
};
