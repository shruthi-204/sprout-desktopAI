import { useEffect, useRef, useState } from "react";

const CHARACTER_WIDTH = 190;
const WALK_SPEED = 60; // px per second
const STEP_DISTANCE = 20; // px per "small step"
const STEPS_MIN = 8;
const STEPS_MAX = 9;
const MIN_IDLE_MS = 3000;
const MAX_IDLE_MS = 8000;
// How far Sprout walks left on startup, entering from just off the right
// edge of the screen until it's comfortably on-screen (not hugging the edge).
const ENTRANCE_DISTANCE = CHARACTER_WIDTH + 200;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomStepCount() {
  return Math.round(randomBetween(STEPS_MIN, STEPS_MAX));
}

function maxX() {
  return Math.max(0, window.innerWidth - CHARACTER_WIDTH);
}

export default function useWalk({ onPhaseChange, paused = false } = {}) {
  // Spawn just past the right edge (fully off-screen) and walk in.
  const [x, setX] = useState(() => maxX() + CHARACTER_WIDTH);
  const [direction, setDirection] = useState(-1);
  const [hasEntered, setHasEntered] = useState(false);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const pausedRef = useRef(paused);
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
    pausedRef.current = paused;
  });

  useEffect(() => {
    const xRef = { current: maxX() + CHARACTER_WIDTH };
    const directionRef = { current: -1 };
    let phase = "walk";
    let phaseEndsAt = 0; // set once the entrance bout finishes
    let walkRemaining = ENTRANCE_DISTANCE;
    let lastTime = performance.now();
    let frameId;
    // While entering, x starts intentionally beyond maxX() (off-screen) —
    // the normal "don't walk past the right edge" clamp must stay off
    // until Sprout has actually walked back within the visible bounds,
    // otherwise it would snap straight to the edge and skip the entrance.
    let hasEnteredScreen = false;

    onPhaseChangeRef.current?.(phase);

    function pickDirection() {
      const limit = maxX();
      if (xRef.current <= 0) return 1;
      if (xRef.current >= limit) return -1;
      return Math.random() < 0.5 ? -1 : 1;
    }

    function tick(now) {
      // Capped so a long stall (a throttled/occluded frame, a GC pause,
      // anything blocking the main thread) can't produce one giant `dt`
      // that finishes or overshoots an entire walk bout in a single jump.
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (pausedRef.current) {
        // Push the phase deadline forward so paused time doesn't count
        // against it and cause a big jump the instant we resume.
        phaseEndsAt += dt * 1000;
        frameId = requestAnimationFrame(tick);
        return;
      }

      if (phase === "idle" && now >= phaseEndsAt) {
        phase = "walk";
        directionRef.current = pickDirection();
        setDirection(directionRef.current);
        walkRemaining = randomStepCount() * STEP_DISTANCE;
        onPhaseChangeRef.current?.(phase);
      }

      if (phase === "walk") {
        const limit = maxX();
        const moveAmount = Math.min(WALK_SPEED * dt, walkRemaining);
        let next = xRef.current + directionRef.current * moveAmount;
        walkRemaining -= moveAmount;

        if (hasEnteredScreen || next <= limit) {
          if (!hasEnteredScreen) setHasEntered(true);
          hasEnteredScreen = true;
          if (next <= 0) {
            next = 0;
            walkRemaining = 0;
          } else if (next >= limit) {
            next = limit;
            walkRemaining = 0;
          }
        }

        xRef.current = next;
        setX(next);

        // Bout finished (walked its short distance, or hit a screen edge)
        // — stop and go back to idle rather than continuing to wander.
        if (walkRemaining <= 0) {
          phase = "idle";
          phaseEndsAt = now + randomBetween(MIN_IDLE_MS, MAX_IDLE_MS);
          onPhaseChangeRef.current?.(phase);
        }
      }

      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return { x, direction, hasEntered };
}
