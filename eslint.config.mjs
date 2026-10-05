// Contrôle statique minimal : détecte un import oublié (no-undef) ou en trop (no-unused-vars) après découpage.
const browser = Object.fromEntries(['window', 'document', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'matchMedia', 'ResizeObserver', 'DOMMatrix', 'localStorage', 'innerWidth', 'innerHeight', 'devicePixelRatio', 'addEventListener',
  'screen', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Event', 'MouseEvent', 'Image', 'OffscreenCanvas', 'console',
  'navigator', 'location', 'URL'].map(k => [k, 'readonly']));
const node = Object.fromEntries(['process', 'console', 'URL'].map(k => [k, 'readonly']));

export default [
  { ignores: ['src/vendor/**', 'dist/**', 'tools/out/**', 'tools/fixtures/**', 'sources/**', 'node_modules/**'] },
  { files: ['src/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: browser },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none' }] } },
  { files: ['tools/**/*.mjs', '*.mjs'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...node, ...browser } },
    rules: { 'no-undef': 'error' } }
];
