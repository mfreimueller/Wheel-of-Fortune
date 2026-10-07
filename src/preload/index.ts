import { contextBridge } from 'electron';

// The renderer talks to the main process only through this narrow, typed surface.
contextBridge.exposeInMainWorld('wheel', {});
