import { createApp } from 'vue';
import { createBrowserApi } from '../web/browserApi';
import { DB_KEY } from '../services/localStore';
import App from './App.vue';
import { reportError } from './composables/useAppError';
import { i18n } from './i18n';
import './styles/tokens.css';
import './style.css';

/** Blocked site data makes even touching `localStorage` throw. */
function storageAvailable(): boolean {
  try {
    localStorage.getItem(DB_KEY);
    return true;
  } catch {
    return false;
  }
}

if (!storageAvailable()) {
  const box = document.getElementById('app');
  if (box) {
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.setAttribute('data-testid', 'no-storage');
    message.style.padding = '24px';
    message.textContent = i18n.global.t('error.noStorage');
    box.replaceChildren(message);
  }
} else {
  window.wheel = createBrowserApi();

  // Ask the browser not to evict our data under storage pressure (best effort).
  void navigator.storage?.persist?.();

  // Another tab changed the database: reload so this tab never works on (and overwrites with) stale data.
  window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY || event.key === null) location.reload();
  });

  window.addEventListener('unhandledrejection', (event) => reportError(event.reason));

  const app = createApp(App).use(i18n);
  app.config.errorHandler = (error) => reportError(error);
  app.mount('#app');
}
