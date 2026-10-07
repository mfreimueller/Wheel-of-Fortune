// Renders assets/icon.png (1024×1024) from an SVG using the Electron that is already installed.
// Usage: node scripts/make-icon.mjs
import { _electron as electron } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const colors = ['#ed1943', '#004a8d', '#d97706', '#059669', '#6d28d9', '#0891b2'];
const r = 400;
const wedge = (i) => {
  const a0 = (i * Math.PI * 2) / colors.length;
  const a1 = ((i + 1) * Math.PI * 2) / colors.length;
  const p = (a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  return `<path d="M0 0 L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z" fill="${colors[i]}" stroke="#fff" stroke-width="8"/>`;
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="-512 -512 1024 1024">
  <rect x="-512" y="-512" width="1024" height="1024" rx="230" fill="#f8fafc"/>
  <g transform="translate(-30 0)">${colors.map((_, i) => wedge(i)).join('')}<circle r="70" fill="#fff"/></g>
  <polygon points="372,0 452,-52 452,52" fill="#111827"/>
</svg>`;

const app = await electron.launch({ args: ['.'] });
const page = await app.firstWindow();
await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
const png = await page.locator('svg').screenshot({ omitBackground: true });
writeFileSync('assets/icon.png', png);
await app.close();
console.log('wrote assets/icon.png');
