// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app, BrowserWindow } = require("electron");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createApp } = require("@flowser/backend");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const isDev = require("electron-is-dev");

// require("@electron/remote/main").initialize();

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // nodeIntegration: true,
      // enableRemoteModule: true,
    },
  });

  win.loadURL(
    isDev
      ? "http://localhost:6060"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );

  try {
    const app = await createApp();
    app.enableCors();
    app.listen(6061);
  } catch (e) {
    console.error("Failed to start @flowser/backend", e);
  }
}

app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
