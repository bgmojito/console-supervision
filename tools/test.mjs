// Tests (à lancer avant chaque commit) : node tools/test.mjs
//  1. smoke : la version dev (src/ servie en http) et dist/index.html (file://, réseau coupé) s'ouvrent sans erreur ;
//  2. équivalence : comparaison au pixel avec l'original de sources/ (horloge figée, thèmes clair et sombre).
// Les originaux sont chargés avec leurs dépendances réseau redirigées vers des copies locales (three.js r128, IBM Plex).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { start } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', 'out');
fs.mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  try { return await import('playwright'); }
  catch { return import(pathToFileURL(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs')).href); }
}
const { chromium } = await loadPlaywright();

/* ---------- Petit cadre de test ---------- */
let failures = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`  ok    ${name}`); }
  catch (e) { failures++; results.push(`  ÉCHEC ${name}\n        ${String(e.message || e).split('\n').join('\n        ')}`); }
  console.log(results[results.length - 1]);
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };

/* ---------- Pages ---------- */
const FIXED = new Date('2026-03-12T09:41:00');
const FONT_DIR = path.join(ROOT, 'src', 'vendor', 'fonts');
// Feuille Google Fonts simulée : mêmes @font-face que le vendor, fichiers servis depuis « fonts.gstatic.com ».
const GOOGLE_CSS = fs.readFileSync(path.join(FONT_DIR, 'plex.css'), 'utf8').replace(/url\(([^)]+)\)/g, 'url(https://fonts.gstatic.com/local/$1)');

async function openPage(browser, url, { scheme = 'light', original = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], external = [];
  page.on('pageerror', e => errors.push('pageerror : ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console : ' + m.text()); });
  await page.clock.setFixedTime(FIXED);
  await page.route(/^https?:\/\//, route => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1')) return route.continue();
    if (original && u.startsWith('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'))
      return route.fulfill({ body: fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'three-r128.min.js')), contentType: 'text/javascript' });
    if (original && u.startsWith('https://fonts.googleapis.com/css2')) return route.fulfill({ body: GOOGLE_CSS, contentType: 'text/css' });
    if (original && u.startsWith('https://fonts.gstatic.com/local/'))
      return route.fulfill({ body: fs.readFileSync(path.join(FONT_DIR, u.split('/').pop())), contentType: 'font/woff2' });
    external.push(u); return route.abort();
  });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return { page, ctx, errors, external };
}

async function shot(page, name) { const f = path.join(OUT, name + '.png'); await page.screenshot({ path: f }); return f; }

// Comparaison de deux PNG dans le navigateur (pas de dépendance) : nombre de pixels différents.
async function diffPng(browser, a, b) {
  const page = await browser.newPage();
  const n = await page.evaluate(async ([ua, ub]) => {
    const img = async s => { const i = new Image(); i.src = s; await i.decode(); return i; };
    const [A, B] = await Promise.all([img(ua), img(ub)]);
    if (A.width !== B.width || A.height !== B.height) return -1;
    const px = I => { const c = new OffscreenCanvas(I.width, I.height), g = c.getContext('2d'); g.drawImage(I, 0, 0); return g.getImageData(0, 0, I.width, I.height).data; };
    const da = px(A), db = px(B); let d = 0;
    for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) d++;
    return d;
  }, [a, b].map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')));
  await page.close();
  return n;
}

/* ---------- Exécution ---------- */
execSync('node tools/build.mjs', { cwd: ROOT, stdio: 'inherit' });
const server = await start(0);
const DEV = `http://127.0.0.1:${server.address().port}/`;
const DIST = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const ORIG = pathToFileURL(path.join(ROOT, 'sources', 'aim-trainer.html')).href;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

for (const [label, url] of [['dev', DEV], ['dist', DIST]]) {
  await test(`${label} : ouverture sans erreur ni requête externe`, async () => {
    const { page, ctx, errors, external } = await openPage(browser, url);
    assert(!errors.length, errors.join('\n'));
    assert(!external.length, 'requêtes externes : ' + external.join(', '));
    assert(await page.title() === 'Supervision — Tableau de bord', 'titre inattendu');
    assert(await page.isVisible('#viewGame') && !(await page.isVisible('#viewFake')), 'la console doit s\'ouvrir sur « Alertes en temps réel »');
    await ctx.close();
  });
  await test(`${label} : Échap bascule vue rapport / temps réel (anti-rebond 400 ms)`, async () => {
    const { page, ctx, errors } = await openPage(browser, url);
    const view = () => page.evaluate(() => ({ fake: !document.getElementById('viewFake').hidden, crumb: document.getElementById('crumb').textContent, boss: document.getElementById('boss').textContent }));
    await page.keyboard.press('Escape');
    let v = await view(); assert(v.fake && v.crumb === 'Rapports › Conformité' && v.boss === 'Temps réel', 'Échap : ' + JSON.stringify(v));
    await page.keyboard.press('Escape');
    v = await view(); assert(v.fake, 'un 2e Échap dans les 400 ms doit être ignoré');
    await page.waitForTimeout(450); await page.keyboard.press('Escape');
    v = await view(); assert(!v.fake && v.crumb === 'Alertes en temps réel' && v.boss === 'Vue rapport', 'retour : ' + JSON.stringify(v));
    await page.click('#boss');
    v = await view(); assert(v.fake, 'le bouton « Vue rapport » doit basculer');
    assert(await page.evaluate(() => document.querySelectorAll('#fakeRows tr').length) === 12, 'tableau de conformité incomplet');
    assert(!errors.length, errors.join('\n'));
    await ctx.close();
  });
}

for (const scheme of ['light', 'dark']) {
  await test(`équivalence au pixel avec l'original : vue rapport (${scheme === 'light' ? 'clair' : 'sombre'})`, async () => {
    const shots = [];
    for (const [label, url, original] of [['orig', ORIG, true], ['dist', DIST, false]]) {
      const { page, ctx } = await openPage(browser, url, { scheme, original });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      shots.push(await shot(page, `rapport-${scheme}-${label}`));
      await ctx.close();
    }
    const d = await diffPng(browser, ...shots);
    assert(d === 0, `${d} pixel(s) différent(s) (voir tools/out/rapport-${scheme}-*.png)`);
  });
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} test(s) en échec` : `\nTous les tests passent (${results.length}).`);
process.exit(failures ? 1 : 0);
