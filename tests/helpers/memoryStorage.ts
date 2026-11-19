/** Minimal in-memory `Storage` for tests. */
export function memoryStorage(initial: Record<string, string> = {}, options: { failWrites?: boolean } = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => {
      if (options.failWrites) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      data.set(key, String(value));
    },
  };
}
