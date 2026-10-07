import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type WheelApi } from '../shared/api';

// The renderer talks to the main process only through this narrow, typed surface.
const api: WheelApi = {
  courses: {
    list: () => ipcRenderer.invoke(CHANNELS.coursesList),
    load: (id) => ipcRenderer.invoke(CHANNELS.courseLoad, id),
  },
  roster: {
    pick: () => ipcRenderer.invoke(CHANNELS.rosterPick),
    import: (input) => ipcRenderer.invoke(CHANNELS.rosterImport, input),
  },
};

contextBridge.exposeInMainWorld('wheel', api);
