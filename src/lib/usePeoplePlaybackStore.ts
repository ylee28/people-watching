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
  peopleBase: PersonBase[];
  timeline: TimelinePerson[];
  peopleAtTime: PersonState[];
  
  // Actions
  play: () => void;
  pause: () => void;
  setTime: (t: number) => void;
  loadData: () => Promise<void>;
  tick: () => void;
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

export const usePeoplePlaybackStore = create<PeoplePlaybackStore>((set, get) => ({
  timeSec: 0,
  isPlaying: false,
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

  tick: () => {
    const { timeSec, isPlaying } = get();
    if (!isPlaying) return;
    
    const newTime = Math.min(timeSec + 1, 300);
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
      const timeline: TimelinePerson[] = await timelineRes.json();
      
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

// Start the tick interval (call this once in the app)
let tickInterval: number | null = null;

export const startPlaybackTicker = () => {
  if (tickInterval) return;
  
  tickInterval = window.setInterval(() => {
    usePeoplePlaybackStore.getState().tick();
  }, 1000);
};

export const stopPlaybackTicker = () => {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
};
