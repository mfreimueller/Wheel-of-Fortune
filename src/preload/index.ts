import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type WheelApi } from '../shared/api';

// The renderer talks to the main process only through this narrow, typed surface.
const api: WheelApi = {
  courses: {
    list: () => ipcRenderer.invoke(CHANNELS.coursesList),
    load: (id) => ipcRenderer.invoke(CHANNELS.courseLoad, id),
    updateStudent: (input) => ipcRenderer.invoke(CHANNELS.studentUpdate, input),
    resetPickCounts: (id) => ipcRenderer.invoke(CHANNELS.countsReset, id),
    setSpecials: (input) => ipcRenderer.invoke(CHANNELS.specialsSet, input),
  },
  roster: {
    pick: () => ipcRenderer.invoke(CHANNELS.rosterPick),
    import: (input) => ipcRenderer.invoke(CHANNELS.rosterImport, input),
  },
  pick: {
    draw: (input) => ipcRenderer.invoke(CHANNELS.pickDraw, input),
    student: (input) => ipcRenderer.invoke(CHANNELS.pickStudent, input),
  },
  export: {
    summary: (courseId) => ipcRenderer.invoke(CHANNELS.exportSummary, courseId),
    run: (input) => ipcRenderer.invoke(CHANNELS.exportRun, input),
  },
  grade: {
    set: (input) => ipcRenderer.invoke(CHANNELS.gradeSet, input),
  },
};

contextBridge.exposeInMainWorld('wheel', api);
