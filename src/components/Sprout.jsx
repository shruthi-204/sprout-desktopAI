import { useEffect, useRef, useState } from "react";
import "../styles/Animations.css";
import useSpriteFrame from "../hooks/useSpriteFrame";
import useWalk from "../hooks/useWalk";
import useTodos from "../hooks/useTodos";
import useIdleScheduler from "../hooks/useIdleScheduler";
import useBlinkOverlay from "../hooks/useBlinkOverlay";
import useReactionController from "../hooks/useReactionController";
import TodoPanel from "./TodoPanel";
import { computeMood, createRapidClickTracker } from "../utils/mood";
import animations from "../utils/animations";

// ── Layout constants ──────────────────────────────────────────────
const RIG_OFFSET = (320 - 190) / 2;
const SCREEN_MARGIN = 12;
const BUBBLE_MAX_WIDTH = 390;
const TODO_ANCHOR_OFFSET = 44;
const TODO_TOGGLE_WIDTH = 34;
const TODO_PANEL_WIDTH = 220;

// ── Timing constants ──────────────────────────────────────────────
const REMIND_LATER_DELAY_MS = 10 * 60 * 1000; // 10 minutes

// Blink is allowed to run over these base/emotion animations — one-shot
// transitions (jump/sit/stand-up/confused/working-done) are deliberately
// excluded because a blink cutting into them wouldn't read well.
const BLINK_COMPATIBLE = new Set([
  "idle", "happy", "tired", "angry", "giggly", "sad", "confused",
  "sit-idle", "working",
]);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function notifyInteraction() {
  window.sproutBridge?.notifyInteraction();
}

function withInteraction(fn) {
  return (...args) => {
    notifyInteraction();
    fn(...args);
  };
}

function Sprout() {
  // ── Core state ────────────────────────────────────────────────
  const [message, setMessage] = useState(null);
  const [messageButtons, setMessageButtons] = useState(null);
  const [isTodoOpen, setIsTodoOpen] = useState(false);
  const [reminderIgnoredCount, setReminderIgnoredCount] = useState(0);
  const [backgroundMood, setBackgroundMood] = useState(null);
  const [phase, setPhase] = useState("idle");
  // True only for the guaranteed-minimum-visible window right after a mood
  // starts showing — pauses walking just long enough to make the pose
  // readable, not for as long as the mood itself persists (see the mood
  // effect below for why those are two different durations).
  const [moodPauseActive, setMoodPauseActive] = useState(false);

  // ── Reminder conversation state ─────────────────────────────
  const [pendingReminder, setPendingReminder] = useState(null);
  const [snoozeCount, setSnoozeCount] = useState(0);

  // ── Hooks ─────────────────────────────────────────────────────
  const { todos, pendingCount, addTodo, toggleTodo, editTodo, deleteTodo } =
    useTodos();
  const { layer, currentStep, requestReaction, advance, release } =
    useReactionController();

  // ── Refs ──────────────────────────────────────────────────────
  const rapidClickRef = useRef(createRapidClickTracker());
  const messageRevertTimerRef = useRef(null);
  const remindLaterTimerRef = useRef(null);
  // Tracks whether the to-do panel was open on the previous render, so the
  // work-session teardown only fires on an actual open→close transition.
  const wasTodoOpenRef = useRef(false);
  // Tracks whether the user typed anything during the current panel-open
  // session, so closing without typing can skip the "working-done" pose.
  const hasTypedInSessionRef = useRef(false);
  // Tracks whether the current mood has already been shown once during this
  // idle pause, so it holds for its full duration exactly once per pause
  // instead of re-triggering itself back to back and blocking the next walk
  // bout (which would break "mood never suppresses walking").
  const moodShownThisIdleRef = useRef(false);
  const moodMinHoldTimerRef = useRef(null);

  // ── Cleanup all timers on unmount ───────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(messageRevertTimerRef.current);
      clearTimeout(remindLaterTimerRef.current);
      clearTimeout(moodMinHoldTimerRef.current);
    };
  }, []);

  // ── Message system ────────────────────────────────────────────
  function showMessage(text, holdMs, buttons) {
    setMessage(text);
    setMessageButtons(buttons || null);
    clearTimeout(messageRevertTimerRef.current);
    if (holdMs != null) {
      messageRevertTimerRef.current = setTimeout(() => {
        setMessage(null);
        setMessageButtons(null);
      }, holdMs);
    }
  }

  // ── Phase changes from walk system ────────────────────────────
  function handlePhaseChange(newPhase) {
    setPhase(newPhase);
    if (newPhase === "walk") {
      // A fresh walk bout means the next idle pause gets its own mood-hold.
      moodShownThisIdleRef.current = false;
      // The mood is sticky (see the mood effect below) so it never auto-reverts
      // on its own — this is what actually ends it, timed to the moment
      // walking resumes rather than to a fixed duration.
      if (layer === "emotion") release();
    }
  }

  // Walking pauses only for layers that visually plant Sprout in place
  // (sitting down, laptop out, or holding a mood face long enough to read);
  // interaction/reaction layers (click, reminders, task celebrations) are
  // allowed to play out mid-walk, same as before this rewrite.
  const { x, direction, hasEntered } = useWalk({
    onPhaseChange: handlePhaseChange,
    paused: isTodoOpen || layer === "work" || layer === "microBehavior" || moodPauseActive,
  });

  // ── Greeting on entrance ──────────────────────────────────────
  useEffect(() => {
    if (hasEntered) showMessage("Hello! I am Sprout 🌱", 4000);
  }, [hasEntered]);


  // ── Idle scheduler (sit / jump micro-behaviors) ───────────────
  function startMicroBehavior(name) {
    const sequence = name === "sit" ? ["sit", "sit-idle", "stand-up"] : [name];
    requestReaction({ layer: "microBehavior", sequence });
  }

  const behaviorActive =
    phase === "idle" && !backgroundMood && !isTodoOpen && layer === null;
  useIdleScheduler(behaviorActive, startMicroBehavior);

  // ── Mood display (persists like a background mood, not a timed flash) ──
  // Previously the mood was just a passive fallback rendered whenever idle
  // with no timer of its own, so it could be shown for as little as
  // whatever was left of the current idle pause before the (unrelated)
  // walk-phase timer fired. `sticky: true` means this never auto-reverts on
  // a holdMs timer the way happy/confused/etc. do — a background mood should
  // persist until its underlying condition changes or walking resumes, not
  // blip once and fall back to a neutral idle face mid-pause. `holdMs` is
  // still used, but only to pause walking for a guaranteed *minimum* visible
  // window (below) — after that, the mood keeps showing for as long as the
  // idle pause naturally lasts, and `handlePhaseChange` (above) is what
  // actually ends it, exactly when walking resumes.
  useEffect(() => {
    if (backgroundMood && phase === "idle" && layer === null && !moodShownThisIdleRef.current) {
      moodShownThisIdleRef.current = true;
      requestReaction({ layer: "emotion", sequence: [backgroundMood], sticky: true });

      setMoodPauseActive(true);
      clearTimeout(moodMinHoldTimerRef.current);
      const minHoldMs = animations[backgroundMood]?.holdMs ?? 3000;
      moodMinHoldTimerRef.current = setTimeout(() => setMoodPauseActive(false), minHoldMs);
    }
  }, [backgroundMood, phase, layer, requestReaction]);

  // If the mood condition itself clears (e.g. tasks completed) while it's
  // still being shown, end it immediately rather than leaving it stuck up
  // until the next walk transition happens to come along.
  useEffect(() => {
    if (!backgroundMood && layer === "emotion") release();
  }, [backgroundMood, layer, release]);

  // ── Blink overlay (background across compatible states) ────────
  // A true overlay (see useBlinkOverlay.js) — it never touches the base
  // animation, so whatever's underneath keeps ticking and is exactly where
  // it left off once the blink clears.
  const currentAnimation = layer ? currentStep : phase;
  const blinkActive = phase === "walk" || BLINK_COMPATIBLE.has(currentAnimation);
  const { isBlinking, blinkFrame } = useBlinkOverlay(blinkActive);

  // ── To-do panel open/close → sit/laptop work session ──────────
  useEffect(() => {
    if (isTodoOpen && !wasTodoOpenRef.current) {
      hasTypedInSessionRef.current = false;
      requestReaction({ layer: "work", sequence: ["sit", "typing-ready"] });
    } else if (!isTodoOpen && wasTodoOpenRef.current && layer === "work") {
      const sequence = hasTypedInSessionRef.current
        ? ["working-done", "stand-up"]
        : ["stand-up"];
      requestReaction({ layer: "work", sequence });
    }
    wasTodoOpenRef.current = isTodoOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTodoOpen]);

  // ── Sprite frame completion handler ───────────────────────────
  const currentFrame = useSpriteFrame(currentAnimation, () => {
    if (!layer) return;
    // Steps with a defined holdMs (e.g. happy, confused) are advanced by
    // the controller's own hold timer instead, so the pose lingers past its
    // last frame rather than snapping back the instant frames finish.
    if (animations[currentAnimation]?.holdMs == null) {
      advance();
    }
  });

  // ── Background mood recomputation ─────────────────────────────
  const prevPendingCountRef = useRef(pendingCount);

  useEffect(() => {
    const justClearedTheList = prevPendingCountRef.current > 0 && pendingCount === 0;
    prevPendingCountRef.current = pendingCount;

    if (justClearedTheList) {
      const honored = requestReaction({ layer: "reaction", sequence: ["jump"] });
      if (honored) showMessage("Everything's done! 🎉", 3000);
      setBackgroundMood(null);
      return;
    }

    setBackgroundMood(
      computeMood({
        pendingTaskCount: pendingCount,
        consecutiveIgnoredReminders: reminderIgnoredCount,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, reminderIgnoredCount]);

  // ── Reminder state from main process ──────────────────────────
  useEffect(() => {
    const unsub = window.sproutBridge?.onReminderState((state) => {
      setReminderIgnoredCount(state.consecutiveIgnoredReminders);
    });
    return () => unsub?.();
  }, []);

  // ── Reminder fires → show interactive speech ──────────────────
  useEffect(() => {
    const unsub = window.sproutBridge?.onReminder((body) => {
      setPendingReminder(body);
      showMessage(body, null, [
        { label: "Done! 👍", action: "done" },
        { label: "Remind later ⏰", action: "snooze" },
      ]);
      // Sticky: holds the sad/angry face until the user actually responds,
      // instead of auto-reverting after that emotion's normal holdMs while
      // the question is still on screen.
      requestReaction({
        layer: "interaction",
        sequence: [snoozeCount >= 2 ? "angry" : "sad"],
        sticky: true,
      });
    });
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snoozeCount]);

  // ── Handle reminder button clicks ─────────────────────────────
  function handleReminderResponse(action) {
    const reminderBody = pendingReminder;
    clearTimeout(messageRevertTimerRef.current);
    setMessage(null);
    setMessageButtons(null);
    setPendingReminder(null);

    if (action === "done") {
      requestReaction({ layer: "interaction", sequence: ["happy"] });
      showMessage("Glad you remembered! 💕", 2500);
      setSnoozeCount(0);
      window.sproutBridge?.notifyInteraction();
    } else if (action === "snooze") {
      const newCount = snoozeCount + 1;
      setSnoozeCount(newCount);

      const snoozeStep = newCount >= 3 ? "angry" : "sad";
      if (newCount >= 3) {
        showMessage("You keep saying that! 😤", 3000);
      } else if (newCount >= 2) {
        showMessage("Okay... but don't forget! 😟", 3000);
      } else {
        showMessage("Okay... I'll check back in a bit", 3000);
      }
      requestReaction({ layer: "interaction", sequence: [snoozeStep] });

      // Bring the same reminder back with response buttons after the delay
      // — this used to just reset the ignored-reminder counter via
      // notifyInteraction(), which silently discarded the snooze instead of
      // actually re-asking.
      clearTimeout(remindLaterTimerRef.current);
      remindLaterTimerRef.current = setTimeout(() => {
        setPendingReminder(reminderBody);
        showMessage(reminderBody, null, [
          { label: "Done! 👍", action: "done" },
          { label: "Remind later ⏰", action: "snooze" },
        ]);
        requestReaction({
          layer: "interaction",
          sequence: [newCount >= 2 ? "angry" : "sad"],
          sticky: true,
        });
      }, REMIND_LATER_DELAY_MS);
    }
  }

  // ── Click interaction (escalating reactions) ──────────────────
  function handleClick() {
    notifyInteraction();
    const reaction = rapidClickRef.current();

    let step, msg;
    if (reaction === "confused") {
      step = "confused";
      msg = "Wait, what were we doing? 😵‍💫";
    } else if (reaction === "giggly") {
      step = "giggly";
      msg = "Okay okay! 😆";
    } else {
      step = "giggly";
      msg = "Hehe! That tickles! ✨";
    }
    const honored = requestReaction({ layer: "interaction", sequence: [step] });
    if (honored) showMessage(msg, animations[step].holdMs);
  }

  // ── Todo typing start / pause ───────────────────────────────────
  function handleFirstKeystroke() {
    notifyInteraction();
    hasTypedInSessionRef.current = true;
    if (layer === "work") {
      requestReaction({ layer: "work", sequence: ["working"] });
    } else {
      // Typing resumed after already standing back up (e.g. right after a
      // previous task's submit) — sit back down before typing.
      requestReaction({ layer: "work", sequence: ["sit", "typing-ready", "working"] });
    }
  }

  function handleTypingPause() {
    // Only meaningful mid-typing — don't interrupt sit/stand-up/etc.
    if (layer === "work" && currentStep === "working") {
      requestReaction({ layer: "work", sequence: ["typing-ready"] });
    }
  }

  // ── Todo add/toggle reactions ──────────────────────────────────
  function handleTodoAdd(text) {
    addTodo(text);
    notifyInteraction();
    showMessage("Added! ✅", 2000);
    requestReaction({ layer: "work", sequence: ["working-done", "happy", "stand-up"] });
  }

  function handleTodoDelete(id) {
    notifyInteraction();
    // Deleting has no message of its own — clear whatever's showing so a
    // leftover message from a prior action (e.g. "Added! ✅" still on
    // screen from a task added seconds ago) doesn't linger over it.
    clearTimeout(messageRevertTimerRef.current);
    setMessage(null);
    setMessageButtons(null);
    deleteTodo(id);
  }

  function handleTodoToggle(id) {
    toggleTodo(id);
    notifyInteraction();
    const todo = todos.find((t) => t.id === id);
    if (todo && !todo.done) {
      showMessage("Done! 💪", animations.happy.holdMs);
      requestReaction({ layer: "reaction", sequence: ["happy"] });
    }
  }

  // ── Pointer events ────────────────────────────────────────────
  function handlePointerEnter() {
    window.sproutBridge?.setIgnoreMouseEvents(false);
  }

  function handlePointerLeave() {
    window.sproutBridge?.setIgnoreMouseEvents(true, { forward: true });
  }

  function handleToggleTodo() {
    notifyInteraction();
    setIsTodoOpen((open) => !open);
  }

  // ── Layout calculations ───────────────────────────────────────
  const rigScreenLeft = x - RIG_OFFSET;
  const rigScreenRight = rigScreenLeft + 320;
  const rigScreenCenter = rigScreenLeft + 160;
  const windowWidth = window.innerWidth;

  const bubbleHalf = BUBBLE_MAX_WIDTH / 2;
  const clampedBubbleCenter = clamp(
    rigScreenCenter,
    SCREEN_MARGIN + bubbleHalf,
    windowWidth - SCREEN_MARGIN - bubbleHalf
  );
  const bubbleShift = clampedBubbleCenter - rigScreenCenter;

  const todoGroupWidth = isTodoOpen ? TODO_PANEL_WIDTH : TODO_TOGGLE_WIDTH;
  const todoNaturalRight = rigScreenRight + TODO_ANCHOR_OFFSET;
  const todoNaturalLeft = todoNaturalRight - todoGroupWidth;
  let todoShift = 0;
  if (todoNaturalRight > windowWidth - SCREEN_MARGIN) {
    todoShift = windowWidth - SCREEN_MARGIN - todoNaturalRight;
  } else if (todoNaturalLeft < SCREEN_MARGIN) {
    todoShift = SCREEN_MARGIN - todoNaturalLeft;
  }

  // ── CSS animation class for bouncing ──────────────────────────
  const animClass =
    currentAnimation === "happy" ? "happy" :
    currentAnimation === "giggly" ? "happy" : "";

  // The laptop art is only drawn facing one way — don't mirror it based on
  // whichever direction Sprout happened to be walking before sitting down.
  const flipDirection = layer === "work" ? 1 : direction;

  return (
    <section
      className="sprout-rig"
      style={{ transform: `translateX(${rigScreenLeft}px)` }}
    >
      {hasEntered && (
        <>
          {/* ── Speech bubble ───────────────────────────────── */}
          {message && (
            <div
              className="speech-bubble"
              style={{ transform: `translateX(calc(-50% + ${bubbleShift}px))` }}
            >
              {message}
              {messageButtons && (
                <div className="speech-buttons">
                  {messageButtons.map((btn) => (
                    <button
                      key={btn.action}
                      type="button"
                      className="speech-btn"
                      onClick={() => handleReminderResponse(btn.action)}
                      onPointerEnter={handlePointerEnter}
                      onPointerLeave={handlePointerLeave}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Todo toggle ─────────────────────────────────── */}
          <button
            type="button"
            className="todo-toggle"
            style={{ transform: `translateX(${todoShift}px)` }}
            aria-label={isTodoOpen ? "Close to-do list" : "Open to-do list"}
            onClick={handleToggleTodo}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
          >
            📋
          </button>

          {/* ── Todo panel ──────────────────────────────────── */}
          {isTodoOpen && (
            <TodoPanel
              todos={todos}
              style={{ transform: `translateX(${todoShift}px)` }}
              onAdd={handleTodoAdd}
              onToggle={handleTodoToggle}
              onEdit={withInteraction(editTodo)}
              onDelete={handleTodoDelete}
              onClose={() => setIsTodoOpen(false)}
              onPointerEnter={handlePointerEnter}
              onPointerLeave={handlePointerLeave}
              onFirstKeystroke={handleFirstKeystroke}
              onTypingPause={handleTypingPause}
            />
          )}
        </>
      )}

      <div className="sprout-flip" style={{ transform: `scaleX(${flipDirection})` }}>
        {/* ── Character (laptop sprites already include the laptop) ── */}
        <button
          type="button"
          className={`sprout-character ${animClass}`}
          onClick={handleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          aria-label="Interact with Sprout"
        >
          <img
            className="sprout-image"
            src={isBlinking ? blinkFrame : currentFrame}
            alt="Sprout desktop companion"
          />
        </button>

        <div className="sprout-shadow"></div>
      </div>
    </section>
  );
}

export default Sprout;
