import { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, Notification } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WINDOW_HEIGHT = 680; // 360 for the character rig + headroom for the to-do panel above it
const WATER_INTERVAL_MS = 2 * 60 * 60 * 1000; // every 2 hours
const STRETCH_INTERVAL_MS = 3.5 * 60 * 60 * 1000; // every 3.5 hours, independent cadence
const projectRoot = path.join(__dirname, "..");

let win = null;
let tray = null;
let awaitingReminderAck = false;
let consecutiveIgnoredReminders = 0;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y + workArea.height - WINDOW_HEIGHT,
    width: workArea.width,
    height: WINDOW_HEIGHT,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // This overlay is an occluded/background window most of the time
      // (other apps sit on top of it) — without this, Chromium throttles
      // requestAnimationFrame while occluded, then delivers one huge
      // catch-up frame when it's uncovered again. That huge frame's `dt`
      // can finish (or overshoot) an entire walk bout in one jump, which
      // looks exactly like the character skipping/sliding backward.
      backgroundThrottling: false,
    },
  });

  win.setIgnoreMouseEvents(true, { forward: true });

  win.on("closed", () => {
    win = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(projectRoot, "dist/index.html"));
  }
}

function createTray() {
  const icon = nativeImage
    .createFromPath(path.join(projectRoot, "src/assets/sprites/hero.png"))
    .resize({ width: 24, height: 24 });

  tray = new Tray(icon);
  tray.setToolTip("Sprout");
  updateTrayMenu();

  tray.on("click", () => {
    toggleWindow();
  });
}

function toggleWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
  }
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray || !win || win.isDestroyed()) return;

  const menu = Menu.buildFromTemplate([
    {
      label: win.isVisible() ? "Hide Sprout" : "Show Sprout",
      click: toggleWindow,
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);
}

function sendReminderState() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("sprout:reminder-state", { consecutiveIgnoredReminders });
}

function fireReminder(body) {
  if (awaitingReminderAck) consecutiveIgnoredReminders += 1;
  awaitingReminderAck = true;
  sendReminderState();

  const notification = new Notification({ title: "Time for a quick break!", body });
  notification.on("click", () => {
    if (win && !win.isDestroyed()) win.show();
  });
  notification.show();

  if (win && !win.isDestroyed() && win.isVisible()) {
    win.webContents.send("sprout:reminder", body);
  }
}

ipcMain.on("sprout:set-ignore-mouse-events", (_event, ignore, opts) => {
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(ignore, opts);
  // The window needs real OS focus for typed input (e.g. the to-do box)
  // to actually reach it — becoming click-through-disabled on hover isn't
  // enough on its own, since that only affects mouse event routing.
  if (!ignore) win.focus();
});

ipcMain.on("sprout:interaction", () => {
  awaitingReminderAck = false;
  if (consecutiveIgnoredReminders !== 0) {
    consecutiveIgnoredReminders = 0;
    sendReminderState();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  setInterval(() => fireReminder("💧 Grab some water"), WATER_INTERVAL_MS);
  setInterval(() => fireReminder("🚶 Stretch your legs"), STRETCH_INTERVAL_MS);
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
