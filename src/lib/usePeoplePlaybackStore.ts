import { create } from 'zustand';

export interface PersonBase {
  id: string;
  angleDeg: number;
  radiusFactor: number;
  bench: string;
  color: string;
  posture: string;
  words: string;
}

export interface TimelinePoint {
  t: number;
  action: string;
  angleDeg: number;
  radiusFactor: number;
  duration?: number; // optional, for path segments
}

export interface TimelinePerson {
  id: string;
  track: TimelinePoint[];
}

export interface PersonState extends PersonBase {
  currentAngleDeg: number;
  currentRadiusFactor: number;
  currentAction: string;
  isVisible: boolean;
  pathHistory: { angleDeg: number; radiusFactor: number; t: number }[];
}

interface PeoplePlaybackStore {
  timeSec: number;
  isPlaying: boolean;
  speed: number; // playback speed multiplier
  peopleBase: PersonBase[];
  timeline: TimelinePerson[];
  peopleAtTime: PersonState[];
  
  // Actions
  play: () => void;
  pause: () => void;
  setTime: (t: number) => void;
  setSpeed: (speed: number) => void;
  loadData: () => Promise<void>;
  tick: (deltaTime: number) => void;
  computePeopleAtTime: () => void;
}

// Helper: interpolate position between two timeline points
const interpolatePosition = (track: TimelinePoint[], t: number) => {
  if (track.length === 0) return null;
  
  let before = track[0];
  let after = track[track.length - 1];
  
  for (let i = 0; i < track.length - 1; i++) {
    if (track[i].t <= t && track[i + 1].t >= t) {
      before = track[i];
      after = track[i + 1];
      break;
    }
  }
  
  if (before === after) return before;
  
  const ratio = (t - before.t) / (after.t - before.t);
  return {
    angleDeg: before.angleDeg + (after.angleDeg - before.angleDeg) * ratio,
    radiusFactor: before.radiusFactor + (after.radiusFactor - before.radiusFactor) * ratio,
    action: before.action,
  };
};

// Helper: get path history up to time t
const getPathHistory = (track: TimelinePoint[], t: number) => {
  return track
    .filter((p) => p.t <= t)
    .map((p) => ({ angleDeg: p.angleDeg, radiusFactor: p.radiusFactor, t: p.t }));
};

// Timeline augmentation: add procedural movements to make the scene more dynamic
const augmentTimeline = (timeline: TimelinePerson[]): TimelinePerson[] => {
  const augmented = timeline.map((person) => ({ ...person, track: [...person.track] }));
  
  // Rim runners: P06, P07, P09 - 2 full clockwise laps between t=150-270s
  const rimRunners = ['P06', 'P07', 'P09'];
  rimRunners.forEach((id, idx) => {
    const person = augmented.find((p) => p.id === id);
    if (!person) return;
    
    const startAngle = idx * 120; // Spread 120° apart
    const lapDuration = 60; // 60s per lap
    
    // Remove existing events in this range if any
    person.track = person.track.filter((p) => p.t < 150 || p.t > 270);
    
    // Add lap events
    person.track.push(
      { t: 150, action: 'stand', angleDeg: startAngle, radiusFactor: 0.92 },
      { t: 150 + lapDuration * 0.25, action: 'walk', angleDeg: startAngle + 90, radiusFactor: 0.92 },
      { t: 150 + lapDuration * 0.5, action: 'walk', angleDeg: startAngle + 180, radiusFactor: 0.92 },
      { t: 150 + lapDuration * 0.75, action: 'walk', angleDeg: startAngle + 270, radiusFactor: 0.92 },
      { t: 150 + lapDuration, action: 'walk', angleDeg: startAngle + 360, radiusFactor: 0.92 },
      // Second lap
      { t: 210 + lapDuration * 0.25, action: 'walk', angleDeg: startAngle + 450, radiusFactor: 0.92 },
      { t: 210 + lapDuration * 0.5, action: 'walk', angleDeg: startAngle + 540, radiusFactor: 0.92 },
      { t: 210 + lapDuration * 0.75, action: 'walk', angleDeg: startAngle + 630, radiusFactor: 0.92 },
      { t: 270, action: 'walk', angleDeg: startAngle + 720, radiusFactor: 0.92 },
    );
    
    person.track.sort((a, b) => a.t - b.t);
  });
  
  // Wide sweepers: P03, P05 - figure-eight sweeps between t=120-240s
  const wideSweepers = ['P03', 'P05'];
  wideSweepers.forEach((id, idx) => {
    const person = augmented.find((p) => p.id === id);
    if (!person) return;
    
    const baseAngle = idx * 180; // 0° and 180°
    
    person.track = person.track.filter((p) => p.t < 120 || p.t > 240);
    
    // Two figure-eight cycles
    for (let cycle = 0; cycle < 2; cycle++) {
      const tBase = 120 + cycle * 60;
      person.track.push(
        { t: tBase, action: 'stand', angleDeg: baseAngle, radiusFactor: 0.92 },
        { t: tBase + 15, action: 'walk', angleDeg: baseAngle + 45, radiusFactor: 0.55 },
        { t: tBase + 30, action: 'walk', angleDeg: baseAngle + 90, radiusFactor: 0.92 },
        { t: tBase + 45, action: 'walk', angleDeg: baseAngle + 180, radiusFactor: 0.55 },
        { t: tBase + 60, action: 'walk', angleDeg: baseAngle + 270, radiusFactor: 0.92 },
      );
    }
    
    person.track.sort((a, b) => a.t - b.t);
  });
  
  // Center drifters: P12, P13 - spiral out from center between t=160-230s
  const centerDrifters = ['P12', 'P13'];
  centerDrifters.forEach((id, idx) => {
    const person = augmented.find((p) => p.id === id);
    if (!person) return;
    
    const baseAngle = idx * 180;
    
    person.track = person.track.filter((p) => p.t < 160 || p.t > 230);
    
    // Spiral out
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = 160 + (i / steps) * 70;
      const r = 0.25 + (0.55 / steps) * i;
      const angle = baseAngle + (360 / steps) * i;
      person.track.push({
        t: Math.round(t),
        action: i === 0 ? 'stand' : 'walk',
        angleDeg: angle,
        radiusFactor: r,
      });
    }
    
    person.track.sort((a, b) => a.t - b.t);
  });
  
  // Enforce exits: ALL 13 people exit by t=300s by moving OUTWARD past the rim
  // Each person gets an exit angle within -10° to +20° (egress region)
  // They tween from their position to radiusFactor > 1.05, then fade
  augmented.forEach((person, idx) => {
    // Remove any existing exit
    person.track = person.track.filter((p) => p.action !== 'exit');
    
    // Determine last known position before exit
    const lastNonExit = person.track[person.track.length - 1] || { 
      t: 295, 
      angleDeg: person.id === 'P01' ? 0 : person.id === 'P04' ? 120 : person.id === 'P11' ? 240 : idx * 30, 
      radiusFactor: 0.92 
    };
    
    // Assign exit angle (spread within -10° to +20°)
    const exitAngle = -10 + (idx / 12) * 30; // Distribute exits across egress zone
    
    // Move toward exit angle at rim (t=295-298s)
    if (lastNonExit.t < 295) {
      person.track.push({ 
        t: 295, 
        action: 'walk', 
        angleDeg: exitAngle, 
        radiusFactor: 0.92 
      });
    }
    
    // Move outward past rim (t=298-299s) - radiusFactor 0.92 → 1.08
    person.track.push({ 
      t: 298, 
      action: 'walk', 
      angleDeg: exitAngle, 
      radiusFactor: 0.92 
    });
    
    person.track.push({ 
      t: 299.5, 
      action: 'walk', 
      angleDeg: exitAngle, 
      radiusFactor: 1.08 
    });
    
    // Exit (fade out at t=300s)
    person.track.push({ 
      t: 300, 
      action: 'exit', 
      angleDeg: exitAngle, 
      radiusFactor: 1.08 
    });
    
    person.track.sort((a, b) => a.t - b.t);
  });
  
  return augmented;
};

export const usePeoplePlaybackStore = create<PeoplePlaybackStore>((set, get) => ({
  timeSec: 0,
  isPlaying: false,
  speed: 1,
  peopleBase: [],
  timeline: [],
  peopleAtTime: [],

  play: () => {
    set({ isPlaying: true });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  setTime: (t: number) => {
    const clampedTime = Math.max(0, Math.min(300, t));
    set({ timeSec: clampedTime });
    get().computePeopleAtTime();
  },

  setSpeed: (speed: number) => {
    set({ speed });
  },

  tick: (deltaTime: number) => {
    const { timeSec, isPlaying, speed } = get();
    if (!isPlaying) return;
    
    const newTime = Math.min(timeSec + deltaTime * speed, 300);
    set({ timeSec: newTime });
    
    if (newTime >= 300) {
      set({ isPlaying: false });
    }
    
    get().computePeopleAtTime();
  },

  loadData: async () => {
    try {
      const [peopleRes, timelineRes] = await Promise.all([
        fetch('/data/people.json'),
        fetch('/data/timeline.json'),
      ]);
      
      const peopleBase: PersonBase[] = await peopleRes.json();
      let timeline: TimelinePerson[] = await timelineRes.json();
      
      // Augment timeline with procedural movements
      timeline = augmentTimeline(timeline);
      
      set({ peopleBase, timeline });
      get().computePeopleAtTime();
    } catch (err) {
      console.error('Failed to load people data:', err);
    }
  },

  computePeopleAtTime: () => {
    const { peopleBase, timeline, timeSec } = get();
    
    const peopleAtTime: PersonState[] = peopleBase.map((base) => {
      // Find timeline track for this person
      const track = timeline.find((t) => t.id === base.id);
      
      if (!track) {
        // No timeline, use base position
        return {
          ...base,
          currentAngleDeg: base.angleDeg,
          currentRadiusFactor: base.radiusFactor,
          currentAction: 'sit',
          isVisible: true,
          pathHistory: [],
        };
      }
      
      // Interpolate current position
      const currentPos = interpolatePosition(track.track, timeSec);
      
      if (!currentPos) {
        return {
          ...base,
          currentAngleDeg: base.angleDeg,
          currentRadiusFactor: base.radiusFactor,
          currentAction: 'sit',
          isVisible: true,
          pathHistory: [],
        };
      }
      
      // Check if person has exited
      const lastPoint = track.track[track.track.length - 1];
      const isVisible = !(lastPoint.action === 'exit' && timeSec >= lastPoint.t);
      
      return {
        ...base,
        currentAngleDeg: currentPos.angleDeg,
        currentRadiusFactor: currentPos.radiusFactor,
        currentAction: currentPos.action,
        isVisible,
        pathHistory: getPathHistory(track.track, timeSec),
      };
    });
    
    set({ peopleAtTime });
  },
}));

// Start the tick with requestAnimationFrame (call this once in the app)
let rafId: number | null = null;
let lastTickTime: number | null = null;

export const startPlaybackTicker = () => {
  if (rafId) return;
  
  const tick = (timestamp: number) => {
    if (lastTickTime === null) {
      lastTickTime = timestamp;
    }
    
    const deltaTime = (timestamp - lastTickTime) / 1000; // Convert to seconds
    lastTickTime = timestamp;
    
    usePeoplePlaybackStore.getState().tick(deltaTime);
    
    rafId = requestAnimationFrame(tick);
  };
  
  rafId = requestAnimationFrame(tick);
};

export const stopPlaybackTicker = () => {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
    lastTickTime = null;
  }
};
