---
name: testing
description: Use after making any change to Sprout, before reporting it as done. Defines how to actually verify a change — running it, observing the real result, checking for regressions — rather than assuming success from the code alone.
---

# Testing Sprout

This skill defines **how** to verify a change actually works. It does not contain project facts — `CLAUDE.md` has the architecture and current state; read it if you need context on what a piece of code is supposed to do. This project has no automated test suite — verification here means actually running the app and observing it, not `npm test`.

## 1. Identify the correct command/test for the change

- Any code change, first: `npm run build`. Fast, catches compile/import errors before you ever launch Electron.
- Run `npm run lint` too, at least once per session touching JS/JSX and after any config change (`eslint.config.js`, `package.json`). It was never run at all for a long stretch of this project's history and immediately caught a real bug (a config gap causing false-positive errors on working `electron/` code) the first time it was — don't assume it's clean just because `build` is.
- Anything behavior-visible (animation, movement, UI, window/tray behavior, IPC, reminders): `npm run dev`, then observe it live (Section 3).
- A packaging/build-config change: `npm run dist`, then verify the produced artifact actually launches (see Section 8) — a successful `electron-builder` run is not the same as a working installed app.
- Don't run a heavier check than the change needs, but don't stop at `npm run build` for anything that changes runtime behavior — a clean compile proves the code is well-formed, not that it does what was intended.

## 2. Before running, check for an existing instance

`tasklist` / `Get-Process electron` (or equivalent). Never launch a second `npm run dev` while one is already running — this has previously caused a new instance's window to silently fail to render. If something needs killing first, target Sprout's own process tree specifically; this machine runs other unrelated projects, so never blanket-kill all `node.exe`/`electron.exe`.

## 3. Observe the actual result — don't assume success

A clean exit code or absence of a thrown error is not verification. For `npm run dev`, confirm the healthy signature: 4 `electron.exe` processes, one titled `sprout-desktop`. Fewer processes or no window title means the renderer failed to spawn even though the command "ran" — that distinction has already caught a real bug in this project. For anything visual, actually look at it (Section 6) rather than inferring correctness from the code.

## 4. Check console/terminal errors and warnings

Read the full `npm run dev` / `npm run build` output, not just the last few lines — capture it to a file and check it rather than eyeballing a scrolling terminal. A warning that looks unrelated to your change is still worth a second look before dismissing it; don't filter to only the errors you expected.

## 5. Test the specific behavior that was changed

Exercise the actual thing you changed, not just its surrounding area. If it's a state transition (e.g., an animation sequence, a mood change, a reaction), confirm it completes and returns to a normal resting state — this project has had a real bug where a one-shot animation had no completion path and left Sprout permanently stuck. "It started" is not the same as "it finished correctly."

## 6. For UI/animation changes, actually inspect the running application when possible

Prefer real observation over reasoning about CSS/JS in the abstract:
- A small, targeted screenshot (or a process/window check when a screenshot isn't necessary) beats assuming a layout or animation looks right from the code.
- Prefer a cropped region over a full-screen capture — this project's overlay spans the whole screen, and full-screen captures have previously picked up unrelated personal content on the user's screen. Crop to the relevant area.
- If a specific interaction can't be verified this way (e.g., simulated clicks missing a moving target, Electron's accessibility tree not being exposed to automation tools), say so plainly and tell the user what to check themselves — don't keep trying increasingly elaborate workarounds, and don't quietly skip reporting the gap.

## 7. Check for regressions in existing behavior

After the specific change verifies, briefly exercise the things most likely to be affected by it — not the whole app, but its actual neighbors (e.g., a change to the idle scheduler should also be checked against walking, mood display, and the to-do panel's pause behavior, since those all interact with it). Use `CLAUDE.md`'s architecture notes to identify what's coupled to what before deciding a regression check is unnecessary.

## 8. For Electron-specific changes, verify the actual desktop behavior

Code-level correctness isn't sufficient for anything touching the main process, window config, tray, or IPC — these only really prove out by running the actual app:
- Window/tray/click-through changes: launch and confirm the window's actual on-screen behavior (transparency, click-through, tray show/hide), not just that `BrowserWindow`/`Tray` were constructed without throwing.
- IPC changes: confirm the message actually round-trips (e.g., a visible effect in the renderer), not just that `ipcMain`/`ipcRenderer` calls compile.
- Packaging changes: run the produced build (the unpacked `.exe` is sufficient to confirm it launches; running the installer itself modifies the user's system and is their call, not something to do unprompted).

## 9. If something fails, use the debugging workflow — don't guess

Switch to the `debugging` skill rather than trying successive ad-hoc fixes here. Testing's job is to detect and clearly report a failure; root-causing and fixing it is debugging's job.

## 10. Never claim something is working without verification

Every claim of "this works" needs a verification method behind it, and the method matters — say which of these you actually did:
- Observed directly (ran it, watched the actual behavior/screenshot/process state) — strongest claim.
- Verified by reading the code/output carefully, without running it — weaker; say so explicitly.
- Not verified at all, because it wasn't possible in this environment — say so explicitly and tell the user what to check.
Never round the second or third case up to the first.

## 11. Clearly report what was tested and the result

When reporting back, state plainly: what you ran, what you observed (not just "it worked"), and which verification tier (Section 10) each claim rests on. If regressions were checked, say what was checked. If something couldn't be verified, name it specifically rather than omitting it.
