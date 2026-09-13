---
name: debugging
description: Use when investigating a bug, error, crash, or "why isn't this working" report on the Sprout desktop-companion project. Defines how to reproduce, root-cause, and fix issues safely without guessing or rewriting working architecture.
---

# Debugging Sprout

This skill defines **how** to debug this project. It does not contain project facts or a bug list — `CLAUDE.md` in the project root has the current architecture, known bugs, and standing constraints; read it first. This skill tells you the process to follow once you're investigating something.

## 1. Inspect before changing anything

Don't edit code as a first move. Read `CLAUDE.md`'s known-bugs and design-decision sections — the issue may already be documented, already have a root cause on record, or be an intentional behavior rather than a bug. Then read the actual source files involved, fresh — this project has been touched by multiple parallel sessions, so the file on disk may not match what any summary (including `CLAUDE.md`) says.

## 2. Reproduce the problem whenever possible

Prefer seeing the failure yourself over reasoning about it in the abstract:

- `npm run build` first — catches compile-level issues fast, before ever touching Electron.
- `npm run dev` for anything behavior-level. Check for a healthy launch: 4 `electron.exe` processes, one titled `sprout-desktop`. Fewer processes or no window title is itself a symptom (the renderer failed to spawn) — that signature alone has previously root-caused a real bug in this project.
- If you can't reproduce it (a UI interaction the tooling can't automate, something environment-specific), say so explicitly rather than guessing at a fix for a symptom you never observed. Ask the user what they're seeing if your own attempt doesn't match their report.

## 3. Read the relevant existing code instead of guessing

Once you can point at the failure, trace it through the actual code path — don't pattern-match to "this looks like a typical X bug" without confirming it in this codebase. If a dependency's behavior is in question (e.g. a build tool, a plugin), check its actual installed version and docs rather than assuming an API from memory or an older major version.

## 4. Identify the root cause before proposing a fix

Distinguish the root cause from the symptom. A stuck animation state, a window that doesn't render, or a component that seems to have vanished can all have causes several layers away from where the symptom shows up — trace it back rather than patching where it happens to surface. Don't fix by trial-and-error edits; know *why* the fix works before making it.

## 5. Prefer the smallest safe change

Fix the root cause with the narrowest change that addresses it. This project's stated preference is "smallest safe changes" — a bug is not license to also refactor, rename, or "clean up" nearby code. If the fix reveals a genuinely bigger architectural problem, say so and raise it separately (see Section 12) rather than folding a rewrite into the bug fix.

## 6. Do not rewrite working architecture unnecessarily

If a fix is possible within the existing pattern, use it — do not replace a working mechanism with a different design because it's cleaner, even if a more elegant approach exists. This project already has one instance of a superseding architecture being designed but never actually finished wiring in, leaving dead code next to a plan that assumes it's live. Don't add to that pattern.

## 7. Do not modify unrelated files

Touch only what the root cause requires. If you notice something else wrong while in a file, note it to the user rather than fixing it inline as part of an unrelated change.

## 8. Respect CLAUDE.md's decisions and constraints

Before changing anything, check it against `CLAUDE.md`'s "Decisions you should not change" and "Things you must NOT modify without asking first" lists. A bug fix does not override those — if the correct fix would require changing something on those lists, that's an architectural choice, not a routine fix (see Section 11).

## 9. Never modify existing Sprout sprite PNGs without asking

Not even ones that look like they contain an artifact or mistake. Ask first, always — this has come up before and the answer was to leave it as-is at the user's choice.

## 10. Be careful with Electron processes

Before running `npm run dev`, check whether a Sprout instance is already running (`tasklist` / `Get-Process electron`). Never launch a second one — this has already caused a real bug (a new instance's window silently failing to render because a stale instance held the dev port). When something needs killing, target Sprout's own process tree specifically (by PID, or by identifying its process tree via command line) — this machine runs other unrelated projects; never blanket-kill all `node.exe`/`electron.exe` on the system.

## 11. If the correct solution requires an architectural choice, stop and ask

Examples already on record in this project: which of two competing blink implementations to keep, whether to finish wiring in a not-yet-applied controller, which event should trigger a sequence. If a bug's real fix is "pick one of two valid designs," that's not yours to decide unilaterally — present the options and their tradeoffs and ask.

## 12. If a fix fails, investigate the new evidence instead of repeatedly guessing

A failed fix is new information, not a reason to try another guess. Re-check your assumption about the root cause using whatever the failure just revealed — a different error, a process that still won't start, a state that's still wrong in a different way. If two attempts at the same class of fix both fail, stop and re-derive the root cause from scratch rather than trying a third variant of the same guess.

## 13. Clearly distinguish confirmed facts from assumptions

When describing a bug or its fix, say plainly which parts you actually observed (a specific error message, a process list, a screenshot, reproduced behavior) versus which parts you're inferring. Don't present an inferred root cause as confirmed until you've verified it — and after fixing, confirm the fix actually works (Section 2's reproduction step, run again) before reporting it as done. If you can't verify a fix in this environment, say that explicitly rather than claiming success.
