import { app, BrowserWindow, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { CourseEditService } from './courseEditService';
import { readConfig, resolveDataDir } from './config';
import { ExportService } from './exportService';
import { GradingService } from './gradingService';
import { registerIpc } from './ipc';
import { PickService } from './pickService';
import { RosterImportService } from './rosterImport';
import { CourseStore } from './store/courseStore';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return win;
}

// Only one instance may touch the JSON files at a time.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  void app.whenReady().then(async () => {
    const userData = app.getPath('userData');
    // WHEEL_DATA_DIR (scripts, tests) beats the folder chosen in the settings dialog.
    const info = resolveDataDir({ env: process.env['WHEEL_DATA_DIR'], config: await readConfig(userData), userData });
    const store = new CourseStore(info.dataDir);
    registerIpc({
      store,
      importer: new RosterImportService(store, (prefix) => `${prefix}_${randomUUID()}`),
      picker: new PickService(store),
      grader: new GradingService(store),
      exporter: new ExportService(store),
      editor: new CourseEditService(store),
      settings: { info, userData },
    });
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
