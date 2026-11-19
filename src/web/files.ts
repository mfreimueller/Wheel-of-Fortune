import type { PickedFile } from '../shared/api';

/** Opens the browser's file chooser; resolves `null` when the user cancels. */
export function pickTextFile(accept: string, maxBytes: number): Promise<PickedFile> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    const done = (result: PickedFile) => {
      input.remove();
      resolve(result);
    };
    input.addEventListener('cancel', () => done(null));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      if (file.size > maxBytes) return done({ ok: false, error: 'too-large' });
      file.text().then(
        (text) => done({ ok: true, name: file.name, text }),
        () => done(null),
      );
    });
    input.click();
  });
}

/** Offers `text` as a file download. */
export function download(name: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
