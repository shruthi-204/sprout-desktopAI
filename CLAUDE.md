# Sprout Desktop Companion — Project Context

This file exists so any Claude session (this one or a future one) can pick up the project without re-deriving everything from scratch. It reflects the actual state of the code as of this writing — including the messy parts. **Read this before making changes.**

Note: work on this project has happened across **multiple parallel Claude Code sessions/windows**, not just one linear conversation. Several major changes below (the architecture migration, the git init) happened in *other* sessions and were only discovered by this one via disk-change notifications or direct file inspection — not lived through firsthand. Don't assume any single conversation's memory is the full picture — this file is the closest thing to ground truth, verified against the actual files on disk.

## What Sprout is

Sprout is a small pixel-art plant/creature character that lives as a real overlay on the user's Windows desktop — not inside a browser tab or a normal app window. It's built as a transparent, click-through, always-on-top Electron window spanning the screen width, so Sprout can walk around on top of whatever else is open, be shown/hidden from a system tray icon, and feel like "a tiny creature living on the desktop" rather than another productivity app.

## Original project goal

The user's own vision doc (given verbatim earlier in this project) asks for:
- A consistent pixel-art character (cream/beige body, dark outline, blush, stem + two leaves) that must **never** be redesigned frame-to-frame — same proportions/palette/outline across every sprite.
- Natural idle life: standing, blinking, walking, sitting, standing back up, occasional jump/wave/dance — but **not constant activity**. "Sometimes it should just stand there peacefully."
- Visible emotions (happy, excited, sad, angry/annoyed, confused, tired, giggly, proud) communicated through sprite animation, not text.
- A **temporary** laptop prop — Sprout does not carry a laptop normally. It only appears when Sprout sits down to do a productivity task (check to-do list, etc.), then disappears.
- Reminders that feel like a conversation (a speech bubble with response options: Yes / Done / Remind me later), with Sprout reacting emotionally to the answer, including getting mildly annoyed after repeated snoozing.
- A lightweight local to-do list (no external APIs needed for v1).
- Click/interaction reactions (happy, wave, giggle, confused, jump...).
- Explicit **build order** the user specified: (1) core motion set — idle/blink/walk/sit/stand/jump — feeling natural first, (2) personality emotions, (3) the laptop/productivity sequence, (4) reminders/to-do, (5) later: calendar/email/AI integrations (explicitly out of scope for v1).
- Explicit art-lock rule: no background/scenery/grass/flowers in any sprite — only Sprout (and, only when relevant, the laptop prop). Sprites must be transparent-background and consistently anchored so frame-swapping doesn't jitter.

## Current architecture and tech stack

- **React 19 + Vite 8** for the UI, **Electron 43** (via `vite-plugin-electron/simple`) for the desktop shell.
- `electron/main.js` — main process: creates the transparent/frameless/always-on-top `BrowserWindow` (click-through by default via `setIgnoreMouseEvents`, re-enabled on hover via IPC, with `.focus()` called on hover-enable so typed input reaches the to-do box), system tray (Show/Hide/Quit), and two independent reminder timers (water every 2h, stretch every 3.5h) that also fire native OS notifications. `backgroundThrottling: false` is set deliberately — this overlay is occluded most of the time, and Chromium throttling `requestAnimationFrame` while occluded then delivering one huge catch-up frame was causing the walk animation to visibly skip/slide.
- `electron/preload.cjs` — contextBridge exposing `window.sproutBridge` (mouse-passthrough toggle, interaction ping that resets the reminder-ignored counter, reminder/reminder-state subscriptions) to the renderer. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Renderer entry: `src/main.jsx` → `src/App.jsx` → `src/components/Sprout.jsx` (the whole app is essentially this one component tree plus `TodoPanel.jsx`).
- **Central animation/reaction architecture** (see "Reaction architecture" below): a single `useReactionController` hook owns a priority-layered animation state machine; blink is a true visual overlay that never touches it.
- Sprite art lives in `src/assets/sprites/**/*.png` and is loaded generically via `import.meta.glob` in `src/utils/spriteFrames.js` — dropping a correctly-named PNG into a folder makes it available with **zero code changes**; frame count is derived at runtime, never hardcoded.
- Packaging: `electron-builder`, NSIS installer, `npm run dist` → `release/Sprout Setup *.exe`.
- **This is now a git repository** (branch `master`, no commits yet as of this writing) — it was not one earlier in this project; the `git init`/`git add` happened in another session, not this one. **Before the first commit, note:** `.freebuff/` (a ~5MB SQLite database + project-id from an unrelated local tool, not part of Sprout) is currently staged and not in `.gitignore` — worth excluding before committing, but that's a decision for the user, not something to fix unilaterally.
- No CI. `node_modules` is large (~530MB) because Electron bundles a full Chromium+Node runtime per platform — this is normal, not something to "fix."

## Reaction architecture (the central animation/emotion system)

This replaced an earlier, more scattered implementation (a pile of `useState`/`useRef` flags and a large if-chain) — that older version is gone from the code now, described here only so its absence isn't mistaken for something broken.

- **`src/hooks/useReactionController.js`** — a `useReducer`-based priority system. State shape: `{ layer, sequence, stepIndex, sticky }`. `layer` is one of `null | "interaction" | "reaction" | "work" | "emotion" | "microBehavior"`; priority order (highest wins): `interaction(5) > reaction(4) > work(3) > emotion(2) > microBehavior(1)`. The base fallback (walk/idle) isn't a layer — it's what's shown when `layer === null`.
  - `requestReaction({ layer, sequence, sticky })` only takes effect if its priority is `>=` whatever's currently active — a lower-priority request is silently dropped (returns `false`, so callers can decide whether to still show an associated message). Any honored request fully replaces prior state, so there's no leftover step/timer to get stuck on.
  - `sequence` is an ordered list of animation-state names (e.g. `["sit", "sit-idle", "stand-up"]`). A step advances either when its sprite animation completes (`loop:false` in `animations.js` — `Sprout.jsx`'s `useSpriteFrame` completion callback calls `advance()`), or after a fixed `holdMs` from `animations.js` (the controller owns this timer itself, decoupled from frame completion — this is *why* a 3-frame `happy` animation that finishes in 750ms still visibly holds for its full ~2500ms before advancing, instead of snapping back early).
  - `sticky: true` suppresses the hold timer entirely — only an explicit new `requestReaction`/`release` call ends it. Used for two things: (1) the reminder conversation, so the sad/angry face doesn't auto-revert while a Yes/Done/Remind-later question is still on screen; (2) background mood (`layer: "emotion"`) — see below.
- **`src/hooks/useBlinkOverlay.js`** — blink is a true overlay: it never touches the reaction controller's state or `currentAnimation` at all. It runs its own randomized 3-7s blink-frame cycle independently; `Sprout.jsx` renders `isBlinking ? blinkFrame : currentFrame`. Whatever base animation was playing keeps ticking underneath and is exactly where it left off once the blink clears — this is what makes "Happy → Blink → Happy" (or Walking, Tired, Working, etc.) not restart the base animation. Compatible states are listed explicitly in `Sprout.jsx`'s `BLINK_COMPATIBLE` set (`idle, happy, tired, angry, giggly, sad, confused, sit-idle, working`, plus whenever `phase === "walk"`); one-shot transitions (`jump, sit, stand-up, working-done`) are excluded because a blink cutting into them wouldn't read well.
- `Sprout.jsx` derives `currentAnimation` as: `layer ? currentStep : phase`. Mood is no longer a special case in this formula — it flows through the `emotion` layer instead (see below), same as everything else.
- **Background mood now routes through the controller as `layer: "emotion"`, sticky.** (This replaced an earlier, simpler "just show it as a passive fallback during idle" approach — see "Current problems / bugs" history below for why that wasn't enough on its own.) When `computeMood()` returns non-null while idle with no other layer active, `Sprout.jsx` calls `requestReaction({ layer: "emotion", sequence: [mood], sticky: true })` — sticky because a background mood should persist until its condition changes, not auto-revert on a timer the way a one-shot reaction does. Walking is paused (via `useWalk`'s `paused` prop) only for a *minimum* guaranteed window matching the mood's `holdMs`, tracked by a separate `moodPauseActive` state — after that window, the mood keeps showing (walking un-pauses but the sticky layer doesn't release yet) until either the walk-phase timer actually fires (an explicit `release()` call in `handlePhaseChange` right when `newPhase === "walk"`) or the mood condition itself clears (a dedicated effect releases immediately in that case, rather than leaving a stale face up). A `moodShownThisIdleRef` ensures this triggers once per idle pause, not repeatedly — that's what keeps "mood never suppresses walking" true even though it now has a guaranteed minimum visible time.

## What has already been implemented

- Real desktop overlay: transparent, frameless, always-on-top, click-through except directly over Sprout or the open to-do panel.
- System tray with Show/Hide/Quit.
- Entrance animation: Sprout walks in from off-screen right on launch rather than just appearing (`useWalk.js`'s `hasEntered` flag; the greeting speech bubble only shows once it has).
- Walking: short randomized "bouts" alternating with idle pauses, bounded to the screen's work-area width.
- Idle micro-behaviors: occasional jump or sit→sit-idle→stand-up (`useIdleScheduler.js`, randomized 3-7s check interval, ~6% sit / ~7% jump / ~87% nothing — deliberately calm, per the user's explicit "don't make it constantly busy" instruction), routed through the reaction controller as `layer: "microBehavior"`.
- Blink: a true non-destructive overlay across all compatible states, including mid-emotion and mid-walk (see architecture section above).
- Mood system (`src/utils/mood.js`): background mood computed from pending to-do count and consecutive-ignored-reminders — `tired` (5+ tasks), `angry` (9+ tasks, or 3+ ignored reminders), `sad` (2+ ignored reminders). Only shown during idle moments; **does not suppress walking**. Now has a guaranteed minimum visible duration and persists like a real background mood rather than a timed flash — see the `emotion` layer description above (this was previously an open problem — a first attempt used a fixed `holdMs`-then-auto-revert, which technically over-corrected into blipping-then-blank for idle pauses longer than `holdMs`; the current `sticky` + explicit-release approach was the fix for that).
- Click reactions, escalating by click-rate (`createRapidClickTracker`): a normal click → `giggly`; 3-4 rapid clicks → `confused`; 5+ rapid clicks → `giggly` again (not a further escalation — may or may not be intentional, unconfirmed).
- Completing the last to-do item triggers a `jump` celebration ("Everything's done! 🎉") and clears any active mood.
- To-do list: add/edit/delete/toggle, persisted to `localStorage`, opened via a small 📋 toggle button.
- **The to-do/laptop work sequence is now correctly sequenced**: opening the panel alone → sit + `typing-ready` (laptop out, waiting pose, no typing yet); the **first actual keystroke** (not focus) → advances to the `working` typing loop; submitting a task → `working-done` → `happy` → `stand-up` → laptop gone, back to normal. Closing the panel without having typed anything skips straight to `stand-up` (no stray "working-done" pose). This was previously wrong (triggered on input focus/blur) — now fixed.
- Reminders are a full mini-conversation: speech bubble with "Done! 👍" / "Remind later ⏰" buttons; the sad/angry face is `sticky` (won't auto-revert) while the question is pending; snoozing 2+/3+ times escalates the face and copy, and — now fixed — a snoozed reminder actually re-surfaces with buttons again after the delay (it previously just silently reset the ignored-reminder counter without re-asking).
- Screen-edge-aware layout: the speech bubble and to-do panel/toggle both clamp their horizontal offset so they never render off-screen even when Sprout is near a screen edge.
- A demo GIF exists at `demo/sprout-demo.gif` (there's also `demo/emotions-demo.gif`, added by another session — not verified by this one) and the standalone installer at `release/Sprout Setup 0.0.0.exe`.

## Current animations and behaviors

Central animation config: `src/utils/animations.js` (`{ loop, frameDuration, holdMs? }` per name). Sprite frames: `src/utils/spriteFrames.js`, keyed by folder name (with a few special cases — see design decisions). Full current animation set:

| Name | Art present? | loop | holdMs | Notes |
|---|---|---|---|---|
| `idle` | yes (1 frame) | true | — | default rest pose |
| `blink` | yes (5) | false | — | true overlay, see architecture section |
| `walk` | yes (6) | true | — | |
| `run` | yes (8) | true | — | **configured but never triggered anywhere in code** |
| `sit` | yes (5) | false | — | → `sit-idle` → `stand-up` sequence |
| `sit-idle` | yes (1, from `sit/sitting-idle.png`) | true | 2500 (fallback in controller) | held seated pose |
| `stand-up` | yes (5) | false | — | |
| `jump` | yes (6) | false | — | micro-behavior + task-cleared celebration |
| `happy` | yes (3, `emotions/happy/`) | false | 2500 | |
| `giggly` | yes (4, `emotions/gigglish/` — folder literally named "gigglish", aliased in code) | true | 3000 | default click reaction |
| `sad` | yes (3, `emotions/sad/`) | true | 3000 | tuned down from 3500 this session — was overshooting its own target range |
| `tired` | yes (4, `emotions/tired/`) | true | 4000 | |
| `angry` | yes (3, `emotions/angry/`) | true | 3500 | |
| `confused` | yes (3, `emotions/confused/`) | false | 3000 | tuned up from 2600 this session — was reading as too brief to register |
| `typing-ready` | yes (`laptop/typing-ready.png`) | true | — (waits for external event: first keystroke) | seated, laptop up, not typing yet |
| `working` | yes (assembled loop from `laptop/typing-{left,right,tongue,blink}.png`) | true | — | |
| `working-done` | yes (`laptop/typing-done.png`) | false | — | |

Not yet implemented (no art, no code): excited, proud, wave, look-around, turn-around, dance — explicitly Phase-2+ per the user's roadmap, deferred on purpose.

## Files that were changed/created (this project, cumulative)

- `electron/main.js`, `electron/preload.cjs` — Electron shell, window, tray, reminders.
- `vite.config.js`, `package.json` (`main`, `dist` script, `build` config for electron-builder) — Electron/Vite wiring and packaging.
- `src/App.jsx`, `src/main.jsx` — trivial mount.
- `src/components/Sprout.jsx` — the main component; large, but now organized around `requestReaction(...)` calls into the central controller rather than scattered flags.
- `src/components/TodoPanel.jsx`, `src/styles/Todo.css` — to-do UI; `onFirstKeystroke`/`onTypingPause` props (not focus/blur — see reaction architecture / to-do sequencing above).
- `src/hooks/useWalk.js` — locomotion (entrance, walk bouts, idle timing, pause support); `paused` now also driven by `moodPauseActive` for the mood minimum-hold window.
- `src/hooks/useReactionController.js` — **now live**, the central priority/reaction state machine (see above). Previously existed unused; now actually wired into `Sprout.jsx`. `PRIORITY` now includes `emotion: 2` for background mood.
- `eslint.config.js` — was applying browser-only globals to everything (including `electron/main.js`/`preload.cjs`, which run under Node) and didn't ignore the generated `dist-electron/` output; both were false-positive lint errors on working code, now fixed with a separate Node-globals block for `electron/**` and an added ignore.
- `src/hooks/useBlinkOverlay.js` — **now live**, the true non-destructive blink overlay (see above). Previously existed unused; now actually wired into `Sprout.jsx`, and has fully replaced the old `useBlinkScheduler.js` (deleted) and the old `useAnimation.js` (deleted — its `previousAnimationRef`/`returnFromBlink` hack is no longer needed now that blink doesn't touch shared state at all).
- `src/hooks/useSpriteFrame.js` — frame-cycling for whatever `currentAnimation` is; its completion callback now just calls the controller's `advance()` when a step has no `holdMs`, rather than a long per-animation-name if-chain.
- `src/hooks/useIdleScheduler.js` — jump/sit micro-behavior scheduler; unchanged itself, just calls `requestReaction(...)` now instead of a local `playAnimation`.
- `src/hooks/useTodos.js` — local-storage-backed to-do CRUD.
- `src/utils/animations.js`, `src/utils/spriteFrames.js`, `src/utils/mood.js` — animation config (incl. `holdMs` per emotion), sprite loading, mood computation.
- `src/styles/App.css`, `src/styles/Animations.css` — layout/transparency + CSS bounce keyframes (only used for the `happy`/`giggly` click reaction bounce; everything else animates via real sprite-frame swapping, not CSS).
- `.claude/skills/{project-planning,debugging,testing}/SKILL.md` — workflow skills for this project (not project facts — they point back here).
- Sprite assets: `emotions/{angry,confused,gigglish,happy,sad,tired}/`, `laptop/typing-{ready,left,right,tongue,blink,done}.png`, plus the original core set (`idle`, `blink`, `walk`, `run`, `sit`, `stand-up`, `jump`).

## Important design decisions

- **Sprite loading is fully generic.** `spriteFrames.js` globs `src/assets/sprites/**/*.png` and groups by folder name + numeric suffix (`name-1.png`, `name-2.png`, ...). Adding/removing/re-numbering frames in an existing folder needs **zero code changes**. Special-cased filenames: `idle/idle-open.png` → `spriteFrames.idle`, `sit/sitting-idle.png` → `spriteFrames["sit-idle"]`, anything under `laptop/` → assembled by name into `working`/`typing-ready`/`working-done` rather than by numeric suffix.
- **Emotion art fallback is conditional, not blind.** `spriteFrames.happy` only falls back to the idle frame if no dedicated `happy` art exists — earlier in the project this was an unconditional overwrite that silently discarded real art the user had added; that was a real bug, now fixed.
- **Character-art lock.** Never rename, resize, recolor, or otherwise "fix" existing sprite PNGs without being asked, even if something looks like an artifact (this came up once with a red crosshair in a draft `angry` frame — it was left in place, at the user's explicit choice, rather than edited).
- **Mood does not suppress walking.** Confirmed explicitly with the user: an active `tired`/`angry`/`sad` mood only shows during idle moments between walk bouts; walking continues normally regardless of mood.
- **No fixed-rhythm timers for autonomous behavior.** The idle (jump/sit) scheduler and the blink overlay both use a self-rescheduling randomized 3-7s gap, specifically to avoid an "obvious" mechanical cadence.
- **Emotion hold durations are deliberately decoupled from sprite frame timing.** Slowing down `frameDuration` was explicitly rejected as a fix for "reactions feel too brief" — the correct mechanism is the controller's separate `holdMs` timer, so intended animation speed is preserved while the pose still lingers long enough to be recognizable.
- **"Smallest safe changes" preference.** The user has explicitly asked for incremental, narrowly-scoped changes rather than large simultaneous rewrites.
- **Electron process hygiene matters.** Never launch a second `npm run dev` while one is already running — this caused a real, confusing bug earlier (stale processes held the dev port, and the new window silently failed to render at all). Always check for/kill stray `electron.exe`/vite processes tied to *this* project specifically before relaunching — not unrelated node processes from the user's other projects, which run on the same machine.
- Standalone packaging (`electron-builder`) was deliberately added early (not deferred) because the user wants to run Sprout without keeping a terminal/editor open — confirmed explicitly, not assumed.

## Current problems / bugs

1. **Unused CSS.** `.sprout-laptop` / `.sprout-laptop-img` in `App.css` have no corresponding element in `Sprout.jsx` — the laptop is drawn as part of the `typing-*.png` character frames directly, not as a separate overlay. Harmless, just dead.
2. **Stray empty file** at `src/assets/sprites/emotions/file` — leftover, not referenced anywhere.
3. **`run` animation is fully configured (8 frames, `animations.run`) but never triggered anywhere.** A project-resource PDF the user later shared explains its intended use: faster movement "returning after a snooze." Legitimate small next step if wanted; not done.
4. **Click-reaction tiering doesn't match the intended design.** A project-resource PDF cross-check confirmed this is a real gap, not just a hunch: the intended escalation is `1 click → happy`, `2nd rapid click → happy variant`, `3-4 → confused`, `5+ → giggly`. Actual code (`mood.js` + `Sprout.jsx`): a normal single click already produces `giggly` (dedicated `happy` art exists but is never shown from a click at all), and 5+ rapid clicks produces the same `giggly` as a single click — no distinct top tier, no 2nd-click variant. Confirmed as a real design gap, deliberately **not fixed** — this changes visible personality/feel, not a bug fix, and is left for the user to decide on.
5. **`.freebuff/` is staged for the first git commit** but isn't part of this project (see "Current architecture" above) — needs `.gitignore` + unstaging before committing, not yet done.
6. No commits exist yet even though the repo is initialized — nothing to `blame`/diff against; this file is still the record instead.

**Resolved since the last time this file was substantially wrong about them** (kept here briefly so nobody "re-fixes" something already done): the blink split-brain (two competing implementations) and the dead `useReactionController.js`/`useBlinkOverlay.js` — both are now the live, working implementation, not drafts. The to-do/laptop sequence triggering on input focus/blur instead of panel-open + first-keystroke — also fixed. Mood-driven emotion duration being unprotected against the walk-phase timer — also fixed (see "Reaction architecture" above); note this took **two** attempts — the first (fixed `holdMs`-then-auto-revert) was itself a partial regression, since it caused moods to blip-then-go-blank during idle pauses longer than `holdMs`, contradicting the "background moods should persist until their condition changes" principle. The second attempt (`sticky` + explicit release on walk-resume or mood-clear) is the current, correct behavior.

An external project-resource PDF the user shared (`Sprout_Desktop_Project_Resource.pdf`) was cross-checked against the actual code — it turned out to be a **stale snapshot** predating the `useReactionController`/`useBlinkOverlay` migration (it still lists the deleted `useAnimation.js`/`useBlinkScheduler.js` as active files). Most of its "Known Technical Issues" were already fixed by the time it was reviewed. Its two genuinely new findings are folded into this list above (#3, #4). It also describes an alternate **2-frame** walk-cycle art proposal that contradicts the actual **6-frame** walk set already in use and already verified working — treated as a discarded alternate idea, not current intent; not acted on.

## The plan we were following

- **This session's own idle-behavior-variety plan** (blink/jump/sit micro-behaviors, randomized scheduling, calmer probabilities) — fully implemented; superseded architecturally by the reaction-controller work below but its scheduling logic (`useIdleScheduler.js`) is unchanged and still live.
- **`C:\Users\Shruthi\.claude\plans\tender-popping-peacock.md`**, *"Sprout: Central Emotion/Reaction Architecture (Phases 1-3)"* — written by a different Claude Code session. **Phases 1-3 are now fully implemented and verified building/launching cleanly** (Phase 1: blink overlay; Phase 2: `useReactionController`, now including the `emotion` layer for background mood, which wasn't in this plan's original scope; Phase 3: to-do/laptop sequencing corrected). Phases 4-7 (occasional/contextual mood escalation beyond the current thresholds, desktop polish, a final regression pass) remain the documented "later" scope in that file — not started.

## What we were about to do next

No single "next step" is prescribed — several independent, legitimate options exist and this is a decision point for the user, not something to pick unilaterally:

1. Decide on the click-reaction-tiering redesign (Bug #4 above) — a personality/feel decision, not a routine fix.
2. Clean up git before the first commit — remove `.freebuff/` from staging and `.gitignore` it.
3. Add new personality emotions (excited, proud, wave, look-around, dance) — blocked on the user providing art, same as every previous emotion.
4. Phases 4-7 of the reaction-architecture plan (see above).
5. Wire `run` to the snooze-return scenario the PDF describes (Bug #3) — small, optional.

## Decisions you should not change without asking

- The build order (core motion → personality emotions → laptop/productivity → reminders/to-do → later integrations) — don't jump ahead to calendar/email/AI features.
- Mood must not suppress walking.
- No fixed-cadence timers for autonomous behavior — keep the randomized-interval pattern.
- The "smallest safe changes" working style.
- Standalone packaging via electron-builder stays in scope (not deferred).
- The click-reaction tier that shows a draft `angry` frame with a known art artifact — left in deliberately at the user's choice; don't "fix" it yourself.
- Emotion hold durations are governed by `holdMs` in `animations.js`, not `frameDuration` — don't "fix" a too-short-feeling reaction by slowing down its sprite animation.
- **`npm run lint` currently reports 4 errors, left in place deliberately.** All 4 are the same rule (`react-hooks/set-state-in-effect`) flagging `setState` calls inside `useEffect` bodies in `Sprout.jsx` (entrance greeting, task-cleared celebration), `useBlinkOverlay.js`, and `useSpriteFrame.js` — all four are verified-working, already-tested patterns. Fixing them for real means restructuring core animation/reaction timing code for a purely cosmetic lint win — decided against, per "smallest safe changes." Don't "clean these up" without asking first.

## Things you must NOT modify without asking first

- **Any existing sprite PNG** under `src/assets/sprites/` — no recolor/resize/crop/rename, including the "misnamed" `gigglish` folder and the empty `emotions/file`. If something looks wrong, ask; don't silently correct it.
- **Electron main-process fundamentals**: transparent window setup, tray, entrance-walk logic — these are working and tested; changes here have historically caused real, hard-to-diagnose bugs (see the stale-process incident above).
- **Git state** — this repo now exists but has no commits yet. Don't stage, commit, or push anything without being asked, and flag anything that looks like it shouldn't be committed (see the `.freebuff/` note) rather than silently fixing the staging area yourself.
