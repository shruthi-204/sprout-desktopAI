import { useCallback, useEffect, useReducer, useRef } from "react";
import animations from "../utils/animations";

// Higher number wins. Anything not listed (the walk/idle fallback shown
// when no layer is active) is effectively priority -1.
const PRIORITY = {
  interaction: 5,
  reaction: 4,
  work: 3,
  emotion: 2,
  microBehavior: 1,
};

// Looping steps that hold for a fixed duration before auto-advancing,
// rather than advancing when their sprite animation completes (loop:false)
// or waiting for an external event ("typing-ready" waits for the first
// keystroke, not a timer, so it deliberately has no holdMs at all).
// animations.js's own holdMs covers most of these already; this is only a
// fallback for entries that don't define one.
const FALLBACK_HOLD_MS = {
  "sit-idle": 2500,
};

function getHoldMs(step) {
  return animations[step]?.holdMs ?? FALLBACK_HOLD_MS[step];
}

const INITIAL_STATE = { layer: null, sequence: [], stepIndex: 0, sticky: false };

function reducer(state, action) {
  switch (action.type) {
    case "REQUEST":
      return {
        layer: action.layer,
        sequence: action.sequence,
        stepIndex: 0,
        sticky: !!action.sticky,
      };
    case "ADVANCE": {
      if (!state.layer) return state;
      const nextIndex = state.stepIndex + 1;
      if (nextIndex < state.sequence.length) {
        return { ...state, stepIndex: nextIndex };
      }
      return INITIAL_STATE;
    }
    case "RELEASE":
      return INITIAL_STATE;
    default:
      return state;
  }
}

export default function useReactionController() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const holdTimerRef = useRef(null);

  const currentPriority = state.layer ? PRIORITY[state.layer] : -1;

  // Only honors the request if it's not being interrupted by something
  // already higher priority. Returns whether it was actually honored, so
  // callers know whether to also show an associated message. Any request
  // that IS honored fully replaces the previous state (fresh stepIndex,
  // and the hold-timer effect below always clears the old timer first) —
  // that's what makes this cancel-safe.
  const requestReaction = useCallback(
    ({ layer, sequence, sticky }) => {
      const requestedPriority = PRIORITY[layer] ?? 0;
      if (requestedPriority < currentPriority) return false;
      dispatch({ type: "REQUEST", layer, sequence, sticky });
      return true;
    },
    [currentPriority]
  );

  const advance = useCallback(() => dispatch({ type: "ADVANCE" }), []);
  const release = useCallback(() => dispatch({ type: "RELEASE" }), []);

  // A step with a defined holdMs is time-driven from the moment it BEGINS
  // (not from when its sprite frames finish) — this is what lets a
  // one-shot animation like "happy" (3 frames, done in 750ms) still visibly
  // hold for its full 2500ms before the sequence advances, instead of
  // snapping back the instant its last frame is reached. Steps with no
  // holdMs advance via Sprout.jsx calling `advance()` when their sprite
  // animation completes instead (loop:false), or never auto-advance at all
  // (loop:true with no holdMs — e.g. "typing-ready", which waits for an
  // explicit external event).
  // `sticky` requests (e.g. "a reminder is awaiting a response") suppress
  // this timer entirely — only an explicit new requestReaction/release call
  // ends them, regardless of the step's own holdMs.
  useEffect(() => {
    clearTimeout(holdTimerRef.current);
    if (state.sticky) return undefined;
    const currentStep = state.sequence[state.stepIndex];
    const holdMs = currentStep ? getHoldMs(currentStep) : undefined;
    if (holdMs != null) {
      holdTimerRef.current = setTimeout(() => dispatch({ type: "ADVANCE" }), holdMs);
    }
    return () => clearTimeout(holdTimerRef.current);
  }, [state.sequence, state.stepIndex, state.sticky]);

  return {
    layer: state.layer,
    currentStep: state.layer ? state.sequence[state.stepIndex] : null,
    requestReaction,
    advance,
    release,
  };
}
