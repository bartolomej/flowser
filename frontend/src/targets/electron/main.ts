import * as path from "path";
import { app, BrowserWindow, shell, dialog } from "electron";
import {
  createApp,
  FlowEmulatorService,
  FlowCliService,
} from "@flowser/backend";
import fixPath from "fix-path";
import { INestApplication } from "@nestjs/common";

fixPath();

const minWidth = 800;
const minHeight = 600;

let backend: INestApplication;

async function createWindow() {
  const win = new BrowserWindow({
    width: minWidth,
    height: minHeight,
    minWidth,
    minHeight,
  });

  // Open urls in the user's browser
  win.webContents.setWindowOpenHandler((data) => {
    shell.openExternal(data.url);
    return { action: "deny" };
  });

  const isDev = !app.isPackaged;
  win.loadURL(
    // This path is currently set to "react", because that's the folder used in @flowser/app package
    // Refer to the app/README for more info on the current build process.
    isDev
      ? "http://localhost:6060"
      : `file://${path.join(__dirname, "../react/index.html")}`
  );

  try {
    const userDataPath = app.getPath("userData");
    const databaseFilePath = path.join(userDataPath, "flowser.sqlite");
    backend = await createApp({
      database: {
        type: "sqlite",
        name: databaseFilePath,
      },
      common: {
        httpServerPort: 6061,
      },
    });
  } catch (e) {
    console.error("Failed to start @flowser/backend", e);
    dialog.showMessageBox(win, {
      message: `Failed to start @flowser/backend: ${String(e)}`,
      type: "error",
    });
  }
}

app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On OS X it is core for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  // On OS X it's core to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("will-quit", async function () {
  // Make sure to stop all child processes, so that they don't become orphans
  const flowEmulatorService = backend.get(FlowEmulatorService);
  const flowCliService = backend.get(FlowCliService);
  await flowCliService.stopDevWallet();
  await flowEmulatorService.stop();
});
