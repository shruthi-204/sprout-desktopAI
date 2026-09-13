---
name: project-planning
description: Use before starting any new feature, fix, or architectural change on the Sprout desktop-companion project. Establishes current state from the real files (never from memory or an old plan alone), reconciles conflicting plans/sessions, and breaks work into small, independently verified increments.
---

# Planning work on Sprout

This skill defines the **workflow** for planning and continuing development on Sprout. It does not contain project facts — `CLAUDE.md` in the project root is the source of truth for what Sprout is, its architecture, current state, known bugs, and standing decisions. Read that file first, every time; this skill tells you what to do with it.

The one fact about this project that shapes everything below: **it has been worked on by multiple parallel Claude Code sessions.** A plan file, or your own memory of "what we built," can be stale the moment you read it. Trust the files on disk over any summary — including `CLAUDE.md` itself, which says so explicitly.

## 1. When to use this skill

Before writing or editing any code in this project. Not needed for a pure question ("what does `useWalk.js` do?") — needed the moment the user asks for a change, a fix, or "what's next."

## 2. Understand the current project

Read `CLAUDE.md` in full. It covers what Sprout is, the original vision, architecture, tech stack, and standing design decisions. Do not restate it back to the user or re-derive it from scratch — just load it into context.

## 3. Establish the current state

`CLAUDE.md` is a snapshot from whenever it was last written — treat it as a starting hypothesis, not ground truth, until you've checked it against the real files. Before planning anything:

- Read the actual files relevant to the change (not just the ones `CLAUDE.md` mentions — grep/glob for anything it might have missed).
- If `CLAUDE.md` names specific hooks, components, or behaviors, confirm they still exist, are still wired up the way described, and still look the way described. Things drift between sessions.
- Check for any plan files under `.claude/plans/` — if one exists and looks relevant, read it fully and compare it against the actual code. A plan file can be stale, superseded, or (as has already happened once in this project) silently overwritten by a different session's plan under the same filename.
- **Never assume something is missing, broken, or unimplemented without checking the actual file.** "The doc doesn't mention X" is not evidence X doesn't exist.

## 4. Define the goal

State plainly, in one or two sentences, what the user is actually asking for and why — not the mechanism, the outcome. If the request is ambiguous or could span wildly different scopes, ask before planning (see Section 5's escalation rule — the same applies here).

## 5. Check existing plans and decisions

Cross-reference the goal against:

- `CLAUDE.md`'s "Decisions you should not change without asking" and "Things you must NOT modify without asking first" sections.
- Any existing plan file(s), reconciled against real files per Section 3.
- The project's stated build order (core motion → personality emotions → laptop/productivity → reminders/to-do → later integrations). Don't jump ahead to a later phase without a clear reason the user has actually given — "it would be nice to have" is not a reason to skip ahead.

If the request conflicts with a standing decision, touches something on the do-not-modify list, or requires picking between two legitimate architectural approaches (e.g., the current blink split-brain, or whether to wire in `useReactionController`) — **stop and ask the user.** Don't decide unilaterally and don't silently pick the option that seems more "correct." This project has had real cross-session decision points before; guessing wrong here has already produced dead code sitting next to a half-followed plan.

## 6. Break work into phases

Match the project's own stated build order and existing phase structure where one exists. Each phase should be independently shippable and independently verifiable — not "80% of a feature that doesn't work yet." Prefer finishing and verifying one phase before scoping the next in detail.

## 7. Break phases into small tasks

Each task should be a single, reviewable change: one hook, one component's wiring, one bug fix. This project's own stated preference is **"smallest safe changes"** — a large simultaneous rewrite (e.g., replacing several hooks and rewriting `Sprout.jsx` in one pass) is exactly the kind of change that has previously ended up half-applied across sessions. Sequence tasks so that after any single one, the app is still in a coherent, runnable state.

## 8. Identify files/components likely to be affected

List them explicitly before writing code — including files that won't be edited but whose behavior matters (e.g., `useSpriteFrame.js`'s frame-completion logic affects every one-shot animation, not just the one you're adding). Use `CLAUDE.md`'s architecture section as a starting index, then confirm against the real files per Section 3.

## 9. Identify risks and dependencies

Specifically check for:

- Whether the change touches anything on the do-not-modify list.
- Whether it depends on sprite art that may not exist yet (this project's sprite loader degrades gracefully when art is missing — confirm whether that's true for the specific animation you're adding, don't assume).
- Whether it interacts with the existing `paused`/mood/interaction-priority logic in `Sprout.jsx` in a way that could leave a stuck state (this has happened before — a one-shot animation with no completion path got Sprout stuck in a reaction forever).
- Whether it requires killing/relaunching the Electron dev process, and if so, that no other `npm run dev` instance for this project is already running first.

## 10. Implement incrementally

One task from Section 7 at a time. After each one, move to Section 11 before starting the next — don't batch verification until the end of a phase.

## 11. Verify after each meaningful step

`npm run build` first (fast compile-correctness check), then `npm run dev` for anything behavior-visible. A healthy launch shows 4 `electron.exe` processes with one titled `sprout-desktop`; fewer processes or no window title means it silently failed to render. Kill only Sprout's own process tree when relaunching — this machine runs other unrelated projects; never blanket-kill all `node.exe`/`electron.exe`.

**Do not claim a feature is complete until you've actually verified it**, and be precise about what "verified" means:
- Confirmed by running it and observing the actual behavior (strongest).
- Confirmed by reading the code carefully and reasoning through it (weaker — say so explicitly).
- Not confirmed at all, because the tooling in this environment couldn't verify it (e.g., a UI interaction that couldn't be automated) — say so plainly and tell the user what to check themselves, rather than skipping the claim or overstating confidence.

If a screenshot is genuinely the only way to verify something, prefer a small cropped region over a full-screen capture, and say when you're relying on one instead of a full test.

## 12. Handle unexpected findings

If implementation reveals the original plan was wrong, incomplete, or based on a stale assumption about the code — stop, update the plan to reflect reality, and say what changed and why before continuing. Don't silently push forward on a plan you now know is wrong, and don't quietly revert a discrepancy you didn't expect (a file being different than remembered is often another session's deliberate work, not a mistake to undo).

## 13. Maintain continuity between sessions

Assume the next session (possibly a different one, working in parallel) will not have this conversation's memory. Before finishing a chunk of work:

- Make sure the state a future session would find on disk is coherent (no half-wired hook, no plan file describing work that wasn't done).
- If `CLAUDE.md` is now stale because of what you just built, say so to the user and offer to update it — don't update it silently without being asked, since it's meant to be an accurate cross-session record, not a running commentary.
- If you leave something deliberately unfinished or deferred, make sure that's stated somewhere a future session would actually find it (the plan file, or a clear note in your final report to the user).

## 14. Final plan/report format

When presenting a plan, structure it as:

- **Goal** — one or two sentences.
- **Current state** — what you verified against the real files, including anything that turned out different from what `CLAUDE.md` or an existing plan said.
- **Phases/tasks** — small, sequenced, each with what "done" looks like.
- **Open questions** — anything requiring the user's decision before proceeding.
- **Verification plan** — how each task will actually be checked, per Section 11.

When reporting completed work, structure it as:

- **What changed** — files and behavior, plainly.
- **What's verified vs. not** — per the precision rule in Section 11. Don't blur these together.
- **What's next** — deferred items, open questions, or the natural next phase.
