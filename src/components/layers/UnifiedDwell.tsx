import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// ====== DEBUG & CONSTANTS (SPEC-LOCKED) ======
(window as any).DEBUG_DWELL = true;
const dlog = (...a: any[]) => (window as any).DEBUG_DWELL && console.log('[DWELL]', ...a);

const DWELL_DEFAULT_DIAM = 10;   // px (MOVING baseline)
const DWELL_GROW_PS      = 10;   // px/s when STILL
const DWELL_STROKE       = 2;

// ====== PERSISTENT STATE (MODULE SCOPE - SINGLE SOURCE OF TRUTH) ======
type DwellState = { lastKey?: string; diamPx: number };
const dwell = new Map<string, DwellState>();

function getDwell(id: string): DwellState {
  let s = dwell.get(id);
  if (!s) { 
    s = { diamPx: DWELL_DEFAULT_DIAM }; 
    dwell.set(id, s); 
  }
  return s;
}

// ====== MOTION SCHEDULE (JSON-BASED) ======
type MotionInterval = { 
  interval: string; 
  tA: number; 
  tB: number; 
  STILL: string[]; 
  MOVING: string[] 
};
type MotionSchedule = { motionSchedule: MotionInterval[] };

let motionSchedule: MotionInterval[] | null = null;
const canonicalId = (id: string) => String(id).trim().toUpperCase();

/**
 * getInterval: Find current interval for timeSec using [tA, tB) logic.
 */
function getInterval(timeSec: number): MotionInterval | null {
  if (!motionSchedule || motionSchedule.length === 0) return null;
  for (const iv of motionSchedule) {
    if (timeSec >= iv.tA && timeSec < iv.tB) return iv;
  }
  // Clamp to last interval if beyond
  return motionSchedule[motionSchedule.length - 1];
}

/**
 * isStill: Check if personId is in STILL list for current interval.
 */
function isStill(personId: string, interval: MotionInterval | null): boolean {
  if (!interval) return false;
  const id = canonicalId(personId);
  return interval.STILL.some(p => canonicalId(p) === id);
}

/**
 * updateDwell: ONLY place that changes ring size.
 * Called every rAF with timeSec and dtSec.
 * 
 * PROOF LOGGING (P01):
 * - IV: interval, motion state
 * - GROW: diameter increasing
 * - DRAW: final radius/diameter
 * - POST-DRAW: verify no override
 */
function updateDwell(personId: string, timeSec: number, dtSec: number) {
  const iv = getInterval(timeSec);
  if (!iv) {
    if (personId === 'P01') dlog('NO-INTERVAL', { t: timeSec.toFixed(1) });
    return;
  }

  const key = `${iv.tA}-${iv.tB}`;
  const s = getDwell(personId);
  const still = isStill(personId, iv);

  // PROOF log: interval + motion
  if (personId === 'P01') {
    dlog('IV', { t: timeSec.toFixed(1), key, motion: still ? 'STILL' : 'MOVING', interval: iv.interval });
  }

  // Reset ONLY when entering a MOVING window
  if (s.lastKey !== key) {
    s.lastKey = key;
    if (!still) {
      s.diamPx = DWELL_DEFAULT_DIAM;
      if (personId === 'P01') dlog('RESET → MOVING', s.diamPx);
    } else {
      if (personId === 'P01') dlog('ENTER STILL (keep diam)', s.diamPx.toFixed(1));
    }
  }

  // Apply rule
  if (still) {
    s.diamPx += DWELL_GROW_PS * dtSec;  // +10 px/sec
    if (personId === 'P01') dlog('GROW', { d: s.diamPx.toFixed(1), dtSec: dtSec.toFixed(4) });
  } else {
    s.diamPx = DWELL_DEFAULT_DIAM;
  }

  // Draw (SVG circle uses RADIUS = diameter / 2)
  const r = s.diamPx / 2;
  const el = document.getElementById(`dwell-ring-${personId}`);
  
  if (el) {
    el.setAttribute('r', String(r));
    el.setAttribute('stroke-width', String(DWELL_STROKE));
    el.setAttribute('fill', 'none');
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    
    // PROOF log: final draw
    if (personId === 'P01') {
      dlog('DRAW', { r: r.toFixed(1), d: s.diamPx.toFixed(1) });
    }
    
    // TRIPWIRE: detect silent overrides (check if r changed immediately after)
    if (personId === 'P01') {
      setTimeout(() => {
        const chk = document.getElementById(`dwell-ring-${personId}`);
        if (chk) {
          const rv = chk.getAttribute('r');
          dlog('POST-DRAW r=', rv, '(should be', r.toFixed(1), ')');
        }
      }, 0);
    }
  } else {
    if (personId === 'P01') {
      dlog('NO-ELEMENT', `dwell-ring-${personId}`);
    }
  }
}

// ====== RAF LOOP (DEDICATED UPDATER) ======
let rafId: number | null = null;
let _lastNow = performance.now();
let _secAccum = 0;

function rafTick() {
  const now = performance.now();
  const dtSec = Math.max(0, (now - _lastNow) / 1000);
  _lastNow = now;
  _secAccum += dtSec;

  const { timeSec, peopleAtTime } = usePeoplePlaybackStore.getState();
  
  // Update ALL visible people (use peopleAtTime keys)
  const personIds = Object.keys(peopleAtTime);
  personIds.forEach(id => updateDwell(id, timeSec, dtSec));

  // Proof: dtSec is flowing
  if (_secAccum >= 1) { 
    dlog('dtSec~1s', _secAccum.toFixed(3)); 
    _secAccum = 0; 
  }

  rafId = requestAnimationFrame(rafTick);
}

function startDwellLoop() {
  if (rafId !== null) return; // Already running
  _lastNow = performance.now();
  _secAccum = 0;
  rafId = requestAnimationFrame(rafTick);
  dlog('🚀 Dwell rAF loop started');
}

function stopDwellLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
    dlog('🛑 Dwell rAF loop stopped');
  }
}

// ====== REACT COMPONENT ======
interface UnifiedDwellProps {
  size?: number;
}

/**
 * Layer 2: Dwell Time - JSON motion schedule driven with direct DOM updates.
 * Shows growing rings around stationary people (STILL state).
 */
export const UnifiedDwell: React.FC<UnifiedDwellProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const timeSec = usePeoplePlaybackStore((state) => state.timeSec);

  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Load motion schedule from JSON (once)
  React.useEffect(() => {
    fetch('/data/motion_schedule.json')
      .then(res => res.json())
      .then((data: MotionSchedule) => {
        motionSchedule = data.motionSchedule;
        dlog('✅ Motion schedule loaded:', motionSchedule.length, 'intervals');
        dlog('First interval:', motionSchedule[0]);
        dlog('Last interval:', motionSchedule[motionSchedule.length - 1]);
      })
      .catch(err => console.error('❌ Failed to load motion schedule:', err));
  }, []);

  // Start/stop dedicated rAF loop
  React.useEffect(() => {
    startDwellLoop();
    return () => stopDwellLoop();
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
    probeEl.style.cssText = 'position:fixed;left:16px;bottom:16px;background:rgba(0,0,0,.8);color:#0f0;padding:8px 12px;border-radius:6px;font:11px/1.4 "Courier New",monospace;pointer-events:none;z-index:9999;border:1px solid #0f0;max-width:380px';
    document.body.appendChild(probeEl);

    return () => {
      const existing = document.getElementById('dwell-probe');
      if (existing) existing.remove();
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  // Update visual probe (React-driven, reads from module state)
  React.useEffect(() => {
    if (!motionSchedule) return;

    const probeEl = document.getElementById('dwell-probe');
    if (!probeEl) return;

    const currentInterval = getInterval(timeSec);
    if (!currentInterval) return;

    const stillCount = currentInterval.STILL.length;
    const movingCount = currentInterval.MOVING.length;
    const mm = Math.floor(timeSec / 60);
    const ss = Math.floor(timeSec % 60);
    
    const p01Still = isStill('P01', currentInterval);
    const p01State = getDwell('P01');
    
    const growingPeople = Array.from(dwell.entries())
      .filter(([_, s]) => s.diamPx > DWELL_DEFAULT_DIAM + 1)
      .sort((a, b) => b[1].diamPx - a[1].diamPx)
      .slice(0, 4);
    
    probeEl.innerHTML = `<strong>Dwell (${stillCount} STILL, ${movingCount} MOVING)</strong><br/>` +
      `time: ${mm}:${ss.toString().padStart(2,'0')} (${timeSec.toFixed(1)}s)<br/>` +
      `interval: ${currentInterval.interval}<br/>` +
      `P01: <strong>${p01Still ? 'STILL' : 'MOVING'}</strong> d=${p01State.diamPx.toFixed(1)}px r=${(p01State.diamPx/2).toFixed(1)}px<br/>` +
      (growingPeople.length > 0 ? 
        `Growing: ${growingPeople.map(([id, s]) => `${id}:${s.diamPx.toFixed(0)}px`).join(', ')}` : 
        'No one growing');
  }, [timeSec]);

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
              const state = getDwell(canId);
              const ringRadius = state.diamPx / 2; // Initial render (rAF will update)

              return (
                <circle
                  key={person.id}
                  id={`dwell-ring-${canId}`}
                  cx={coord.x}
                  cy={coord.y}
                  r={ringRadius}
                  fill="none"
                  stroke={person.color}
                  strokeWidth={DWELL_STROKE}
                  strokeOpacity={0.9}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
        </g>
      </svg>
    </div>
  );
};