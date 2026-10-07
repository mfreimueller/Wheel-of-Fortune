/// <reference types="vite/client" />
import type { WheelApi } from '../shared/api';

declare global {
  interface Window {
    wheel: WheelApi;
  }
}
