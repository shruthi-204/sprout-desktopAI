const TIRED_TASK_THRESHOLD = 5;
const ANGRY_TASK_THRESHOLD = 9;
const ANGRY_IGNORED_REMINDERS = 3;
const SAD_IGNORED_REMINDERS = 2;
const GIGGLY_CLICK_COUNT = 5;
const CONFUSED_CLICK_COUNT = 3;
const CLICK_WINDOW_MS = 1200;

/**
 * Compute a background mood from persistent state (tasks, reminders).
 * Does NOT handle click reactions — those are event-driven in Sprout.jsx.
 */
export function computeMood({ pendingTaskCount, consecutiveIgnoredReminders }) {
  if (consecutiveIgnoredReminders >= ANGRY_IGNORED_REMINDERS) return "angry";
  if (consecutiveIgnoredReminders >= SAD_IGNORED_REMINDERS) return "sad";
  if (pendingTaskCount >= ANGRY_TASK_THRESHOLD) return "angry";
  if (pendingTaskCount >= TIRED_TASK_THRESHOLD) return "tired";
  return null;
}

/**
 * Track rapid clicks and return the appropriate reaction level:
 *  - null       = normal single click (happy)
 *  - "confused" = 3-4 clicks in quick succession
 *  - "giggly"   = 5+ clicks in quick succession
 */
export function createRapidClickTracker() {
  let recentClicks = [];

  return function registerClick() {
    const now = Date.now();
    recentClicks = recentClicks.filter((t) => now - t < CLICK_WINDOW_MS);
    recentClicks.push(now);

    const count = recentClicks.length;
    if (count >= GIGGLY_CLICK_COUNT) return "giggly";
    if (count >= CONFUSED_CLICK_COUNT) return "confused";
    return null;
  };
}
