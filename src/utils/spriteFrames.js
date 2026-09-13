const modules = import.meta.glob("../assets/sprites/**/*.png", {
  eager: true,
  import: "default",
});

const spriteFrames = {};
const laptopByName = {};

for (const path in modules) {
  const match = path.match(/sprites\/(?:emotions\/)?([^/]+)\/([^/]+)\.png$/);
  if (!match) continue;

  const [, group, filename] = match;

  if (group === "idle" && filename === "idle-open") {
    spriteFrames.idle = [modules[path]];
    continue;
  }

  if (filename === "sitting-idle") {
    spriteFrames["sit-idle"] = [modules[path]];
    continue;
  }

  if (group === "laptop") {
    // Named by pose, not a numbered sequence — assembled into an ordered
    // loop below rather than by the generic numbered-suffix handling.
    laptopByName[filename] = modules[path];
    continue;
  }

  const frameMatch = filename.match(/-(\d+)$/);
  if (!frameMatch) continue;

  const frameIndex = Number(frameMatch[1]);
  if (!spriteFrames[group]) spriteFrames[group] = [];
  spriteFrames[group][frameIndex - 1] = modules[path];
}

if (!spriteFrames.happy?.length) {
  spriteFrames.happy = spriteFrames.idle;
}

// The folder is physically named "gigglish" (not renamed, per the art-lock
// rule), but the animation is referred to as "giggly" everywhere in code.
if (!spriteFrames.giggly?.length && spriteFrames.gigglish?.length) {
  spriteFrames.giggly = spriteFrames.gigglish;
}

const WORKING_LOOP_ORDER = [
  "typing-left",
  "typing-right",
  "typing-tongue",
  "typing-right",
  "typing-left",
  "typing-blink",
];
spriteFrames.working = WORKING_LOOP_ORDER.map((name) => laptopByName[name]).filter(Boolean);
// A genuinely still "laptop's up, not typing yet" pose — kept separate
// from the `working` loop so it doesn't cycle/animate while waiting.
if (laptopByName["typing-ready"]) {
  spriteFrames["typing-ready"] = [laptopByName["typing-ready"]];
}
if (laptopByName["typing-done"]) {
  spriteFrames["working-done"] = [laptopByName["typing-done"]];
}

export default spriteFrames;
