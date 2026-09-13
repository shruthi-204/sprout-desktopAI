const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sproutBridge", {
  setIgnoreMouseEvents: (ignore, opts) => {
    ipcRenderer.send("sprout:set-ignore-mouse-events", ignore, opts);
  },
  notifyInteraction: () => {
    ipcRenderer.send("sprout:interaction");
  },
  onReminder: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("sprout:reminder", listener);
    return () => ipcRenderer.removeListener("sprout:reminder", listener);
  },
  onReminderState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("sprout:reminder-state", listener);
    return () => ipcRenderer.removeListener("sprout:reminder-state", listener);
  },
});
