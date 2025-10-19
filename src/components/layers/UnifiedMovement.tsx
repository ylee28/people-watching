import * as React from "react";
import { CircularGrid } from "../CircularGrid";
import { polarToCartesian } from "@/lib/roomGeometry";
import { usePeoplePlaybackStore } from "@/lib/usePeoplePlaybackStore";

// ====== PERSON COLORS (AUTHORITATIVE) ======
const COLOR: Record<string, string> = {
  P01: '#d3dcdd',
  P02: '#e4c7d0',
  P03: '#55533e',
  P04: '#a28948',
  P05: '#5a3b4f',
  P06: '#192f46',
  P07: '#859bcc',
  P08: '#5550e9',
  P09: '#d3d3d3'
};

const pid = (id: string) => id.trim().toUpperCase();

// ====== TRAIL CONSTANTS ======
const STROKE_OPACITY = 0.22;   // subtle "paint" look
const STROKE_WIDTH = 3;        // brush thickness
const MIN_DIST_PX = 2;         // add point only if moved ≥ 2px

// ====== TRAIL STATE (MODULE SCOPE) ======
type Trail = { d: string; lastX?: number; lastY?: number };
const trails = new Map<string, Trail>();

function ensureTrailEl(personId: string, groupId: string): SVGPathElement {
  const id = pid(personId);
  let el = document.getElementById(`path-trail-${id}`) as unknown as SVGPathElement | null;
  if (!el) {
    el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('id', `path-trail-${id}`);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', COLOR[id] || '#000');
    el.setAttribute('stroke-width', String(STROKE_WIDTH));
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('stroke-opacity', String(STROKE_OPACITY));
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    document.getElementById(groupId)?.appendChild(el);
  }
  return el;
}

function appendTrailPoint(personId: string, x: number, y: number, groupId: string) {
  const id = pid(personId);
  let t = trails.get(id);
  if (!t) {
    t = { d: '' };
    trails.set(id, t);
  }

  const el = ensureTrailEl(id, groupId);

  const dx = t.lastX == null ? Infinity : Math.abs(x - t.lastX);
  const dy = t.lastY == null ? Infinity : Math.abs(y - t.lastY);
  const dist = Math.hypot(dx, dy);

  if (t.d === '') {
    // Start new path
    t.d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
  } else if (dist >= MIN_DIST_PX) {
    // Add line segment only if moved enough
    t.d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  } else {
    // Too small a move, skip to avoid bloating path
    return;
  }

  t.lastX = x;
  t.lastY = y;
  el.setAttribute('d', t.d);
  el.setAttribute('stroke', COLOR[id] || '#000'); // ensure color stays in sync
}

// ====== RAF LOOP (UPDATES TRAILS) ======
let rafId: number | null = null;

function updatePathLayer(groupId: string) {
  const { peopleAtTime } = usePeoplePlaybackStore.getState();
  const center = 260; // size/2 = 520/2
  const maxRadius = 240; // size/2 - 20

  peopleAtTime
    .filter(p => p.isVisible)
    .forEach(person => {
      const coord = polarToCartesian(
        center,
        center,
        maxRadius * person.currentRadiusFactor,
        person.currentAngleDeg
      );
      appendTrailPoint(person.id, coord.x, coord.y, groupId);
    });

  rafId = requestAnimationFrame(() => updatePathLayer(groupId));
}

function startPathLoop(groupId: string) {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => updatePathLayer(groupId));
}

function stopPathLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// ====== REACT COMPONENT ======
interface UnifiedMovementProps {
  size?: number;
}

/**
 * Layer 4: Movement Paths - Paintbrush trails that accumulate as people move
 */
export const UnifiedMovement: React.FC<UnifiedMovementProps> = ({ size = 520 }) => {
  const peopleAtTime = usePeoplePlaybackStore((state) => state.peopleAtTime);
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  const groupId = 'path-layer-group';

  // Start/stop trail update loop
  React.useEffect(() => {
    startPathLoop(groupId);
    return () => stopPathLoop();
  }, [groupId]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CircularGrid size={size} />
      <svg width={size} height={size} className="absolute inset-0">
        <g id={groupId}>
          {/* Trails are appended dynamically via DOM manipulation */}
          {/* Moving dots rendered by React */}
          {peopleAtTime
            .filter(person => person.isVisible)
            .map(person => {
              const coord = polarToCartesian(
                center,
                center,
                maxRadius * person.currentRadiusFactor,
                person.currentAngleDeg
              );

              const id = pid(person.id);
              const color = COLOR[id] || '#000';

              return (
                <circle
                  key={person.id}
                  cx={coord.x}
                  cy={coord.y}
                  r="6"
                  fill={color}
                />
              );
            })}
        </g>
      </svg>
    </div>
  );
};
