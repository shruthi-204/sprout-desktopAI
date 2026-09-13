const animations = {
  idle: {
    name: "idle",
    loop: true,
    frameDuration: 600,
  },

  blink: {
    name: "blink",
    loop: false,
    frameDuration: 120,
  },

  // --- Emotions ---
  // holdMs: how long the emotion displays before auto-reverting.
  // One-shot emotions (loop: false) auto-complete via frame count;
  // looped emotions rely on holdMs for their exit timer.
  happy: {
    name: "happy",
    loop: false,
    frameDuration: 250,
    holdMs: 2500,
  },

  giggly: {
    name: "giggly",
    loop: true,
    frameDuration: 300,
    holdMs: 3000,
  },

  sad: {
    name: "sad",
    loop: true,
    frameDuration: 400,
    holdMs: 3000,
  },

  tired: {
    name: "tired",
    loop: true,
    frameDuration: 500,
    holdMs: 4000,
  },

  angry: {
    name: "angry",
    loop: true,
    frameDuration: 400,
    holdMs: 3500,
  },

  confused: {
    name: "confused",
    loop: false,
    frameDuration: 200,
    holdMs: 3000,
  },

  // --- Motion ---
  walk: {
    name: "walk",
    loop: true,
    frameDuration: 160,
  },

  run: {
    name: "run",
    loop: true,
    frameDuration: 120,
  },

  sit: {
    name: "sit",
    loop: false,
    frameDuration: 300,
  },

  jump: {
    name: "jump",
    loop: false,
    frameDuration: 140,
  },

  "stand-up": {
    name: "stand-up",
    loop: false,
    frameDuration: 220,
  },

  "sit-idle": {
    name: "sit-idle",
    loop: true,
    frameDuration: 800,
  },

  // --- Working ---
  // Genuinely still — single frame, no cycling — for "laptop's up, not
  // typing yet" instead of looping the full typing motion while idle.
  "typing-ready": {
    name: "typing-ready",
    loop: true,
    frameDuration: 600,
  },

  working: {
    name: "working",
    loop: true,
    frameDuration: 260,
  },

  "working-done": {
    name: "working-done",
    loop: false,
    frameDuration: 700,
  },
};

export default animations;
