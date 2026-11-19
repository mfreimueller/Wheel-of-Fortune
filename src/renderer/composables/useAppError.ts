import { ref } from 'vue';
import { StoreWriteError } from '../../services/localStore';

/** The last unexpected error, shown as a banner. */
export const appError = ref<unknown>(null);

export function reportError(error: unknown): void {
  console.error(error);
  appError.value = error;
}

export const isStoreWriteError = (error: unknown): boolean => error instanceof StoreWriteError;
