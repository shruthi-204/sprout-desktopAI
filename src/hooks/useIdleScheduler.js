import { useEffect, useRef } from "react";

const MIN_INTERVAL_MS = 3000;
const MAX_INTERVAL_MS = 7000;
const SIT_CHANCE = 0.06;
const JUMP_CHANCE = 0.07;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default function useIdleScheduler(active, onTrigger) {
  const onTriggerRef = useRef(onTrigger);
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  });

  useEffect(() => {
    if (!active) return undefined;

    let timeoutId;

    function scheduleNext() {
      timeoutId = setTimeout(() => {
        const roll = Math.random();
        if (roll < SIT_CHANCE) {
          onTriggerRef.current("sit");
        } else if (roll < SIT_CHANCE + JUMP_CHANCE) {
          onTriggerRef.current("jump");
        }
        // otherwise (~87%): stay peacefully idle this tick
        scheduleNext();
      }, randomBetween(MIN_INTERVAL_MS, MAX_INTERVAL_MS));
    }

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [active]);
}
